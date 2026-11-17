import { runs } from "eve/events"
import { defineHook } from "eve/hooks"

import { readCaller } from "@/usecases/agent"
import { chargeText, hasCredits } from "@/usecases/credits"

// The one credits guard, and where eve's model runs are charged. A turn of an organization with no credits left fails before its first model call, with no retry, and each channel's own failure path ends the run or answers the chat. eve puts `Hook "hooks/credits.ts" failed: ` before the message.
// A turn that is already running when the credits reach 0 runs to its end. Each usage eve records for a model run is charged for its tokens at the run's model's list price, under its place in the session's stream, so a repeat charges nothing
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const { caller } = readCaller(ctx)
      const credits = await hasCredits(caller)
      if (!credits.ok) throw new Error(credits.error.message)
      if (!credits.value) throw new Error("Out of credits. Upgrade your plan or buy credits in Settings → Billing.")
    },
    async "usage.recorded"(event, ctx) {
      const { personaId } = readCaller(ctx)
      const { owner, usage } = event.data
      const id = `${ctx.session.id}:${ctx.position.line}:${ctx.position.index}`

      const charges = runs(ctx.view)
        .filter((run) => owner && "runId" in owner && run.runId === owner.runId && run.modelId)
        .map(async (run) => { await chargeText(personaId, id, run.modelId!, usage).catch((error) => console.warn("Token usage was not saved.", id, error)) })

      await Promise.all(charges)
    },
  },
})
