import type { JsonValue } from "@prisma/orm-postgres/contract/types"
import { type ChannelSendOptions, defineChannel, POST } from "eve/channels"
import { parts } from "eve/events"
import { z } from "zod"

import { channel as metaChannel, encodePrincipal as metaPrincipal, encodeThreadId as metaThreadId } from "@/agent/channels/meta"
import { channel as telegramChannel, encodePrincipal as telegramPrincipal, encodeThreadId as telegramThreadId } from "@/agent/channels/telegram"
import { channel as whatsappChannel, encodePrincipal as whatsappPrincipal, encodeThreadId as whatsappThreadId } from "@/agent/channels/whatsapp"
import { channel as zernioChannel, encodePrincipal as zernioPrincipal, encodeThreadId as zernioThreadId } from "@/agent/channels/zernio"
import { readTriggerEvent } from "@/lib/composio"
import { queue } from "@/lib/queue"
import { db } from "@/prisma/db"
import { toPrincipal } from "@/usecases/agent"
import { completeRun, failRun, runResult } from "@/usecases/runs"

type Run = { runId: string; title: string }

const channel = defineChannel<undefined, void, Run>({
  routes: [    // The route sits under /eve/v1/, since withEve forwards only that prefix to eve

    // Composio posts every event of the project here, signed. An event of a trigger we hold waits for the trigger's next run, which start.ts makes five minutes after the first waiting event. A trigger we don't hold, or another kind of event, keeps nothing
    POST("/eve/v1/triggers", async (request) => {
      const event = await readTriggerEvent(request)
      if (!event) return Response.json({ error: "Not allowed." }, { status: 401 })

      const trigger = await db.orm.public.Trigger.where({ id: event.triggerId, personaId: event.userId }).first()
      if (!trigger) return Response.json({ ok: true })

      // Composio sends an event again, with the same id, when it gets no answer in time; the event is kept once
      await db.orm.public.TriggerEvent.createAll([{ id: event.id, triggerId: trigger.id, data: event.data as JsonValue }], { onConflict: "skip", conflictOn: ["id"] })

      return Response.json({ ok: true }, { status: 202 })
    }),

    // Starts a trigger run: the queue service calls it with AUTOMATIONS_SECRET. A run that already has a session is left alone; when it ends, a run worth telling reports to its chat
    POST("/eve/v1/triggers/:triggerId/:runId", async (request, { params, to }) => {
      const secret = process.env.AUTOMATIONS_SECRET
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed." }, { status: 401 })

      // Check the run exists and has no session yet, and get its events, oldest first
      const run = await db.orm.public.Run
        .include("trigger", (trigger) => trigger.include("persona"))
        .include("events", (events) => events.orderBy((event) => event.createdAt.asc()))
        .where({ id: params.runId, triggerId: params.triggerId })
        .first()
      if (!run) return Response.json({ error: "This run does not exist." }, { status: 404 })
      if (run.sessionId) return Response.json({ ok: true, runId: run.id })
      const trigger = run.trigger!

      // Get the principal for the trigger
      const auth = toPrincipal({
        orgId: trigger.persona.orgId,
        userId: `trigger:${trigger.id}`,
        personaId: trigger.personaId,
        channel: "trigger"
      })

      // The events go to the agent as files in its sandbox
      const prompt = `
          Your trigger "${trigger.name}" just fired: ${trigger.slug} on one of your connected apps. Its events of the last few minutes are attached as files, ${run.events.length} in all (trigger-event-1.json and on); read them to see what happened.
          Do the task below once, for all of them.\n\nThe task: ${trigger.prompt}
        `
      const files = run.events.map((event, index) => ({ type: "file" as const, data: new TextEncoder().encode(JSON.stringify(event.data)), mediaType: "application/json", filename: `trigger-event-${index + 1}.json` }))

      // Send the prompt and the events to the run's session
      const delivery = await to(channel, { runId: run.id, title: run.title }).send([{ type: "text" as const, text: prompt }, ...files], { auth })
      await db.orm.public.Run.where({ id: run.id }).updateAll({ sessionId: delivery.sessionId })

      return Response.json({ ok: true, runId: run.id }, { status: 202 })
    }),

    // Tells the run's chat what came of it: the queue service calls it as soon as a run worth telling ends, with AUTOMATIONS_SECRET. The run id is the delivery key, so a run the queue hands over again reaches the chat once
    POST("/eve/v1/triggers/:triggerId/:runId/report", async (request, { params, to }) => {
      const secret = process.env.AUTOMATIONS_SECRET
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed." }, { status: 401 })

      // Get the ended run with its persona and its chat, by its id alone: its trigger may have been deleted while it ran
      const run = await db.orm.public.Run.include("persona").include("link").where({ id: params.runId, source: "trigger" }).first()
      if (!run || !run.result || !run.link) return Response.json({ error: "This run does not exist." }, { status: 404 })
      const link = run.link

      // Tell what came of it in the trigger's words
      const message = `Your trigger "${run.title}" just fired on one of your connected apps; this isn't a message from the person. Open the conversation. Tell them what came of it, in your own words:\n\n${run.result.summary}`

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
          if (run?.result?.notify && run.link?.personaId === run.personaId) await queue.send([{ path: `/eve/v1/triggers/${run.triggerId}/${run.id}/report`, delaySeconds: 0 }])
        } catch (error) {
          console.error("Could not end a run or queue its report.", error)
        }
      }
    },
  },
})

export default channel
