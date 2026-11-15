import { defineEval } from "eve/evals"
import { includes, satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { saveFile } from "@/usecases/files"

// The word is only inside the file, so the answer can only come from reading it
export default defineEval<typeof config>({
  description: "Asked what one of its files says, the persona finds the file, reads it and answers.",
  tags: ["files"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const password = marker("wifi")
    const name = `${marker("house")}.txt`
    const saved = await saveFile(caller, personaId, { name, contentType: "text/plain", bytes: new TextEncoder().encode(`House notes\n\nThe wifi password is ${password}.`) })
    if (!saved.ok) throw new Error(saved.error.message)

    const turn = await t.send(`What's the wifi password in my file ${name}?`, { headers })
    t.succeeded()
    const tools = turn.toolCalls.map((call) => call.name)
    t.check(tools, satisfies((names) => Array.isArray(names) && (names.includes("file_read") || names.includes("file_list")), "it uses its file tools"))
    t.check(said(turn), includes(password))
  },
})
