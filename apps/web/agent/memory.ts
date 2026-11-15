import supermemory from "@supermemory/eve"
import { defineMemory, defineMemoryProvider } from "eve/memory"
import { setTimeout as sleep } from "node:timers/promises"

import { readCaller } from "@/usecases/agent"

const LIMIT_MS = 3_000
const RUN_CHANNELS = ["automation", "webhook", "trigger"]

const { recall, capture, tools } = supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY! })

// Each call gets 3 s: the abort stops its requests, and the sleep stops the wait, since Supermemory's SDK waits out a 429's retry-after even after an abort
export default defineMemory({
  description: "This persona's memory: the people it talks to, what they like, and what is going on in their lives.",
  provider: defineMemoryProvider({
    recall: {
      async "turn.started"(context) {
        const { channel } = readCaller(context)
        if (RUN_CHANNELS.includes(channel)) return null

        const load = recall["turn.started"]
        if (!load) return null

        const abortSignal = AbortSignal.any([context.abortSignal, AbortSignal.timeout(LIMIT_MS)])
        const loaded = load({ ...context, abortSignal })
        return Promise.race([loaded, sleep(LIMIT_MS, null)])
      },
    },
    capture: {
      async "turn.completed"(context) {
        const { channel } = readCaller(context)
        if (RUN_CHANNELS.includes(channel)) return

        const save = capture?.["turn.completed"]
        if (!save) return

        const abortSignal = AbortSignal.any([context.abortSignal, AbortSignal.timeout(LIMIT_MS)])
        const saved = save({ ...context, abortSignal })
        await Promise.race([saved, sleep(LIMIT_MS)])
      },
    },
    tools,
  }),
  scope(ctx) { return readCaller(ctx).personaId },
})
