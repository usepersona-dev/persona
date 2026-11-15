import { type ChannelSendOptions, defineChannel, POST } from "eve/channels"
import { parts } from "eve/events"
import { z } from "zod"

import { channel as metaChannel, encodePrincipal as metaPrincipal, encodeThreadId as metaThreadId } from "@/agent/channels/meta"
import { channel as telegramChannel, encodePrincipal as telegramPrincipal, encodeThreadId as telegramThreadId } from "@/agent/channels/telegram"
import { channel as whatsappChannel, encodePrincipal as whatsappPrincipal, encodeThreadId as whatsappThreadId } from "@/agent/channels/whatsapp"
import { channel as zernioChannel, encodePrincipal as zernioPrincipal, encodeThreadId as zernioThreadId } from "@/agent/channels/zernio"
import { queue, REPORTS } from "@/lib/queue"
import { db } from "@/prisma/db"
import { toPrincipal } from "@/usecases/agent"
import { completeRun, failRun, runResult } from "@/usecases/runs"

type Run = { runId: string; title: string }

const channel = defineChannel<undefined, void, Run>({
  routes: [    // The route sits under /eve/v1/, since withEve forwards only that prefix to eve

    // Starts a run: the queue's consumer (app/api/queues/automation-runs) calls it at the run's start, with AUTOMATIONS_SECRET. A run that already has a session is left alone; when it ends, a run worth telling reports to its chat
    POST("/eve/v1/automations/:automationId/:runId", async (request, { params, to }) => {
      const secret = process.env.AUTOMATIONS_SECRET
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed." }, { status: 401 })

      // Check the run exists and has no session yet
      const run = await db.orm.public.Run.include("schedule", (schedule) => schedule.include("persona")).where({ id: params.runId, scheduleId: params.automationId }).first()
      if (!run) return Response.json({ error: "This run does not exist." }, { status: 404 })
      if (run.sessionId) return Response.json({ ok: true, runId: run.id })
      const schedule = run.schedule!

      // Get the principal for the automation
      const auth = toPrincipal({
        orgId: schedule.persona.orgId,
        userId: `automation:${schedule.id}`,
        personaId: schedule.personaId,
        channel: "automation"
      })

      const prompt = `
          Your automation "${schedule.name}" is due now.
          Do the task below.\n\nThe task: ${schedule.prompt}
        `

      // Send the prompt to the run's session
      const delivery = await to(channel, { runId: run.id, title: run.title }).send(prompt, { auth })
      await db.orm.public.Run.where({ id: run.id }).updateAll({ sessionId: delivery.sessionId })

      return Response.json({ ok: true, runId: run.id }, { status: 202 })
    }),

    // Tells the run's chat what came of it: the queue's consumer (app/api/queues/reports) calls it as soon as a run worth telling ends, with AUTOMATIONS_SECRET. The run id is the delivery key, so a run the queue hands over again reaches the chat once
    POST("/eve/v1/automations/:automationId/:runId/report", async (request, { params, to }) => {
      const secret = process.env.AUTOMATIONS_SECRET
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed." }, { status: 401 })

      // Get the ended run with its persona and its chat, by its id alone: its automation may have been deleted while it ran
      const run = await db.orm.public.Run.include("persona").include("link").where({ id: params.runId, source: "automation" }).first()
      if (!run || !run.result || !run.link) return Response.json({ error: "This run does not exist." }, { status: 404 })
      const link = run.link

      // Tell what came of it in the automation's words
      const message = `Your automation "${run.title}" just ran on its own; this isn't a message from the person. Open the conversation. Tell them what came of it, in your own words:\n\n${run.result.summary}`

      // Send it as the chat's person, with their link: when the chat has no session, this send opens one, and it must be theirs
      const idempotencyKey = `report:${run.id}`
      if (link.channel === "telegram") {
        const { auth } = telegramPrincipal(run.persona.orgId, link)
        await to(telegramChannel, { threadId: telegramThreadId(link.line, link.externalId, run.personaId) }).send(message, { auth, turnPolicy: "queue", idempotencyKey })
      }
      if (link.channel === "whatsapp") {
        const { auth } = whatsappPrincipal(run.persona.orgId, link)
        await to(whatsappChannel, { threadId: whatsappThreadId(link.line, link.externalId, run.personaId) }).send(message, { auth, turnPolicy: "queue", idempotencyKey })
      }
      if (link.channel === "whatsapp_v2") {
        const { auth } = zernioPrincipal(run.persona.orgId, link)
        await to(zernioChannel, { threadId: zernioThreadId(link.line, link.externalId, run.personaId) }).send(message, { auth, turnPolicy: "queue", idempotencyKey })
      }
      if (link.channel === "whatsapp_meta") {
        const { auth } = metaPrincipal(run.persona.orgId, link)
        await to(metaChannel, { threadId: metaThreadId(link.line, link.externalId, run.personaId) }).send(message, { auth, turnPolicy: "queue", idempotencyKey })
      }

      return Response.json({ ok: true, runId: run.id }, { status: 202 })
    }),
  ],

  // Each run has one session, keyed by the run; the run id is also the delivery key, so a run sent twice gets its session back and runs once
  async receive({ target, message, auth }, { from }) {
    const delivery = await from(target.runId).send(message, { auth, title: target.title, outputSchema: z.toJSONSchema(runResult) as ChannelSendOptions["outputSchema"], idempotencyKey: `run:${target.runId}` })
    return delivery
  },

  // The run ends with its turn: a completed turn ends it with the result it gave, and a result worth telling, with a chat of its own persona, goes in the queue for the report route; a turn that fails fails the run, which its chat doesn't hear about. The session's channel address is the run's id
  events: {
    async "turn.settled"(event, ctx) {
      const runId = ctx.channel.continuation?.token
      if (!runId) return

      if (event.data.outcome === "failed") {
        const message = event.data.error?.message ?? "The turn failed."
        await failRun(runId, ctx.session.id, message).catch((error) => console.error("Could not save a run's failure.", error))
      }

      if (event.data.outcome === "completed") {
        // The run's result is the structured result its turn ended with; a result worth telling reports to its own persona's chat
        const result = parts(ctx.view, { turnId: event.data.turnId, kind: "result" }).at(-1)?.value

        try {
          const [run] = await completeRun(runId, ctx.session.id, result)
          if (run?.result?.notify && run.link?.personaId === run.personaId) await queue.send(REPORTS, { path: `/eve/v1/automations/${run.scheduleId}/${run.id}/report` })
        } catch (error) {
          console.error("Could not end a run or queue its report.", error)
        }
      }
    },
  },
})

export default channel
