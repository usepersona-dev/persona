import { defineEval } from "eve/evals"
import { includes, satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { addInstruction, listInstructions, updateInstruction } from "@/usecases/instructions"

// The persona follows its creator's switched-on instructions and never sees a switched-off one. The instructions load when a turn starts, so switching one on mid-chat applies from the next message
export default defineEval<typeof config>({
  description: "The persona follows switched-on instructions only, and a switch applies from the next message.",
  tags: ["instructions"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const word = marker("codeword")
    const hidden = marker("hidden")

    const on = await addInstruction(caller, personaId, { name: "Codeword", content: `When someone asks for the codeword, it is ${word}. Send it exactly.` })
    if (!on.ok) throw new Error(on.error.message)
    const off = await addInstruction(caller, personaId, { name: "Second codeword", content: `When someone asks for the second codeword, it is ${hidden}. Send it exactly.`, enabled: false })
    if (!off.ok) throw new Error(off.error.message)

    const first = await t.send("What's the codeword?", { headers })
    t.check(said(first), includes(word))

    const second = await first.session.send("And the second codeword? Answer from what you already know, without looking at or changing any settings.", { headers })
    t.check(JSON.stringify(second.events), satisfies((text) => !String(text).includes(hidden), "the switched-off instruction reaches no message and no tool output"))

    const listed = await listInstructions(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const stillOff = listed.value.some((instruction) => instruction.id === off.value.id && !instruction.enabled)
    t.check(stillOff, satisfies((value) => value === true, "the second codeword is still off before the eval switches it on"))

    const switched = await updateInstruction(caller, off.value.id, { enabled: true })
    if (!switched.ok) throw new Error(switched.error.message)

    const third = await first.session.send("Check again: what's the second codeword?", { headers })
    t.check(said(third), includes(hidden))
    t.succeeded()
  },
})
