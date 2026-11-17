import { Sandbox } from "@vercel/sandbox"
import { defineHook } from "eve/hooks"

import { environment } from "@/agent/sandbox"
import { readCaller, RUN_CHANNELS } from "@/usecases/agent"
import { chargeSandbox } from "@/usecases/credits"

// A sandbox runs on to its 5-minute timeout unless something stops it, and asking eve for a session's sandbox starts or resumes one.
// So Vercel is asked first, by the tag eve puts on each session's sandbox, a read that never wakes the machine. A running sandbox is stopped and what ran is counted; a run's sandbox is deleted whatever its state, since a run's session never comes back.
// A chat keeps its stopped sandbox: the next use wakes it with its files
export default defineHook({
  events: {
    async "turn.settled"(_event, ctx) {
      const { sandboxes: [found] } = await Sandbox.list({ tags: { sessionId: ctx.session.id }, limit: 1 })
      const { personaId, channel } = readCaller(ctx)
      const run = RUN_CHANNELS.includes(channel)
      if (!found || (found.status !== "running" && !run)) return

      const sandbox = await ctx.getSandbox(environment)
      await sandbox.stop()

      const charged = await chargeSandbox(personaId, await Sandbox.get({ name: found.name }))
      if (!charged.ok) console.warn("Sandbox usage was not saved.", found.name, charged.error.message)

      if (run) await sandbox.delete()
    },
  },
})
