import { defineHook } from "eve/hooks"

import { readCaller } from "@/usecases/agent"
import { hasCredits } from "@/usecases/credits"

// The one credits guard. A turn of an organization with no credits left fails before its first model call, with no retry, and each channel's own failure path ends the run or answers the chat. eve puts `Hook "hooks/credits.ts" failed: ` before the message.
// A turn that is already running when the credits reach 0 runs to its end
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const { caller } = readCaller(ctx)
      const credits = await hasCredits(caller)
      if (!credits.ok) throw new Error(credits.error.message)
      if (!credits.value) throw new Error("Out of credits. Upgrade your plan or buy credits in Settings → Billing.")
    },
  },
})
