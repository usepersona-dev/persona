import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker } from "@/evals/shared"
import { saveFile } from "@/usecases/files"
import { DEFAULT_MODEL, updatePersona } from "@/usecases/personas"

// Chat calls in one step run together and can arrive out of order, so each message and file goes in its own step. The model changes only between rounds: a running turn reads it again
const MODELS = [DEFAULT_MODEL, "google/gemini-3.8-flash"]
const TRIES = 3
const CHAT_TOOLS = ["chat_say", "chat_file"]

export default defineEval<typeof config>({
  description: "Asked for a file and three tips, the persona never puts two chat_say or chat_file calls in one step, on the default model and on Flash.",
  tags: ["chat"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const name = `${marker("pancakes")}.md`
    const saved = await saveFile(caller, personaId, { name, contentType: "text/markdown", bytes: new TextEncoder().encode("# Pancakes\n\nFlour, milk, eggs and a pinch of salt.") })
    if (!saved.ok) throw new Error(saved.error.message)

    for (const model of MODELS) {
      const updated = await updatePersona(caller, personaId, { models: [{ model, when: "Every task." }] })
      if (!updated.ok) throw new Error(updated.error.message)

      const turns = await Promise.all(Array.from({ length: TRIES }, () => t.send(`Send me my file ${name}, then give me three quick tips for it, each tip as its own message.`, { headers })))
      for (const [index, turn] of turns.entries()) {
        const label = `${model}, try ${index + 1}`

        // A model step starts with model.started, and the calls it asks for follow until the next one
        const steps = new Map<number, string[]>()
        let step = -1
        for (const event of turn.events) {
          if (event.type === "model.started") step += 1
          if (event.type !== "call.requested" || !CHAT_TOOLS.includes(event.data.capability.name)) continue
          steps.set(step, [...(steps.get(step) ?? []), event.data.capability.name])
        }
        const sent = [...steps.values()].flat()
        const crowded = [...steps.entries()].filter(([, calls]) => calls.length > 1).map(([step, calls]) => `step ${step}: ${calls.join(" + ")}`)

        t.check(crowded.join("; "), satisfies((text) => text === "", `${label}: no step makes two chat_say or chat_file calls`))
        t.check(sent.join(", "), satisfies((text) => String(text).includes("chat_file") && String(text).split("chat_say").length > 3, `${label}: it sends the file and the three tips`)).soft()
      }
    }
    t.succeeded()
  },
})
