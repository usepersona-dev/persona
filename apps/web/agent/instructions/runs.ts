import { defineDynamic, defineInstructions } from "eve/instructions"

import { readCaller, RUN_CHANNELS } from "@/usecases/agent"

const RUNS = `# Runs

You're in a run, not a chat: an automation, trigger or webhook started you to do one task on your own.

- Nobody sent you this, nobody reads along, and nobody can answer questions.
- If something you need is missing, say what and stop.
- The chat tools reach no one here. Only your result does: when notify is true, we pass it on to the person in their chat.
- End with your result: what came of it, and notify when the person should hear it.`

// The run rules load in runs of automations, triggers and webhooks only
export default defineDynamic((ctx) => {
  const { channel } = readCaller(ctx)
  if (!RUN_CHANNELS.includes(channel)) return null

  const result = defineInstructions({ content: RUNS })
  return result
})
