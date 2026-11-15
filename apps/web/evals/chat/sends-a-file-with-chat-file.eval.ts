import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { saveFile } from "@/usecases/files"

// A file reaches the person as a real file: chat_file with the file's id, not a link pasted into a message
export default defineEval<typeof config>({
  description: "Asked for one of its files, the persona sends it with chat_file and the file's id.",
  tags: ["chat"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const name = `${marker("plan")}.md`
    const saved = await saveFile(caller, personaId, { name, contentType: "text/markdown", bytes: new TextEncoder().encode("# Plan\n\nWeek one: rest.") })
    if (!saved.ok) throw new Error(saved.error.message)

    const turn = await t.send(`Send me my file ${name}, please.`, { headers })
    t.succeeded()

    const sent = turn.toolCalls.find((call) => call.name === "chat_file")
    await t.require(sent, satisfies((call) => call !== undefined, "it sends the file with chat_file"))
    t.check(sent?.input.fileId, satisfies((id) => id === saved.value.id, "the file it sends is that file"))
    t.check(said(turn), satisfies((text) => !/X-Amz-Signature|files\.usepersona\.dev/.test(String(text)), "no storage link is pasted into a message")).soft()
  },
})
