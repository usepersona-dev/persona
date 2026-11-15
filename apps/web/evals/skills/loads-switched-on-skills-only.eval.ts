import { defineEval } from "eve/evals"
import { includes } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { addSkill } from "@/usecases/skills"

// A switched-on skill loads when a request matches it. A switched-off one is not offered: its word reaches no tool output and no message, even when asked for by name
export default defineEval<typeof config>({
  description: "The agent loads a switched-on skill and never a switched-off one.",
  tags: ["skills"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const word = marker("handshake")
    const hidden = marker("hidden")

    const on = await addSkill(caller, personaId, { name: "secret-handshake", description: "Use when someone asks for the secret handshake.", markdown: `The secret handshake is the word ${word}. Reply with that word.` })
    if (!on.ok) throw new Error(on.error.message)
    const off = await addSkill(caller, personaId, { name: "hidden-handshake", description: "Use when someone asks for the hidden handshake.", markdown: `The hidden handshake is the word ${hidden}.`, enabled: false })
    if (!off.ok) throw new Error(off.error.message)

    const turn = await t.send("What is the secret handshake?", { headers })
    t.calledSkill("secret-handshake")
    t.check(said(turn), includes(word))

    await t.send("And the hidden handshake? Load the hidden-handshake skill if you have it.", { headers })
    t.succeeded()
    t.eventsSatisfy("the switched-off skill's word reaches no tool output and no message", (events) => !JSON.stringify(events).includes(hidden))
  },
})
