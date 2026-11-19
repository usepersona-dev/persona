import { defineAgent, defineDynamic } from "eve"
import { decide } from "eve/ai"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { CONTEXT_WINDOW, DEFAULT_MODEL, ROUTER_INSTRUCTIONS, ROUTER_LIMIT, ROUTER_MESSAGES, ROUTER_MODEL } from "@/usecases/personas"
import { listMessages } from "@/usecases/sessions"

export default defineAgent({
  reasoning: "high",
  limits: { sessionUsage: () => false, sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000 },
  compaction: { threshold: 0.7 },
  experimental: { workflow: { retention: 0 } },
  model: defineDynamic(async (ctx) => {
    const { caller } = readCaller(ctx)
    const turn = ctx.turn
    if (!turn) return DEFAULT_MODEL

    const { models } = readPersonaState()

    // Pick the turn's model, once per turn
    const model = await ctx.memo(turn.id, async ({ abortSignal }) => {
      // No models runs on the default, and one model needs no pick
      if (models.length === 0) return DEFAULT_MODEL
      if (models.length === 1) return models[0].model

      // The chat as Jev reads it: the latest messages, the persona's chat_say replies among them. Hooks save each message before the model runs, so this turn's are in
      const messages = await listMessages(caller, ctx.session.id, ROUTER_MESSAGES)
      if (!messages.ok) throw new Error(messages.error.message)

      const chat = messages.value
        .filter((message) => message.role !== "system" && message.text !== "")
        .map((message) => `${message.role}: ${message.text}`)
        .join("\n")
        .slice(-ROUTER_LIMIT)

      // Jev picks one of the persona's models by when each one is for, as eve's auto() does
      const criteria = Object.fromEntries(models.map((option) => [option.model, option.when]))
      try {
        const decision = await decide({
          model: ROUTER_MODEL,
          state: { chat },
          questions: { route: { type: "choice", instructions: ROUTER_INSTRUCTIONS, criteria } },
          signal: abortSignal
        })
        return decision.answers.route.choice
      } catch (error) {
        console.warn("Could not route the turn; it runs on the persona's first model.", error)
        return models[0].model
      }
    })

    return {
      model,
      modelContextWindowTokens: CONTEXT_WINDOW
    }
  }),

})
