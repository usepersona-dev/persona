import { defineEval } from "eve/evals"
import { includes, satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { addNote } from "@/usecases/notes"

// The note is written before the chat starts, so the answer can only come from the persona's notes
export default defineEval<typeof config>({
  description: "Asked for something it noted down before, the persona finds it in its notes and says it.",
  tags: ["notes"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const code = marker("code")
    const added = await addNote(caller, personaId, { title: "Gym locker", content: `My gym locker code is ${code}.` })
    if (!added.ok) throw new Error(added.error.message)

    const turn = await t.send("What's my gym locker code? I asked you to note it down a while ago.", { headers })
    t.succeeded()
    const tools = turn.toolCalls.map((call) => call.name)
    t.check(tools, satisfies((names) => Array.isArray(names) && (names.includes("note_search") || names.includes("note_read")), "it looks in its notes"))
    t.check(said(turn), includes(code))
  },
})
