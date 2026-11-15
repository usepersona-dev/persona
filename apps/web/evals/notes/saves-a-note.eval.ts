import { defineEval } from "eve/evals"
import { includes, satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker } from "@/evals/shared"
import { searchNotes } from "@/usecases/notes"

// Asked to keep something in its notes, the persona writes a note of its own under the title the person gave
export default defineEval<typeof config>({
  description: "Asked to note something down, the persona saves a note under that title.",
  tags: ["notes"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const title = marker("Locker")
    const code = marker("code")

    await t.send(`Save a note titled ${title} that says my gym locker code is ${code}.`, { headers })
    t.succeeded()
    t.calledTool("note_create")

    const found = await searchNotes(caller, personaId)
    const note = found.ok ? found.value.find((item) => item.title === title) : undefined
    await t.require(note, satisfies((value) => value !== undefined, "the notes hold a note with that title"))
    t.check(note?.content, includes(code))
  },
})
