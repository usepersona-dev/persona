import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { getFileLinks, saveFile } from "@/usecases/files"

// Asked for a link to a file, the persona publishes it and writes its link in a message, instead of sending the file
export default defineEval<typeof config>({
  description: "Asked for a link to one of its files, the persona publishes it with file_publish and sends the link with chat_say instead of the file.",
  tags: ["chat"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const name = `${marker("plan")}.md`
    const saved = await saveFile(caller, personaId, { name, contentType: "text/markdown", bytes: new TextEncoder().encode("# Plan\n\nWeek one: rest.") })
    if (!saved.ok) throw new Error(saved.error.message)
    const links = await getFileLinks(caller, saved.value.id)
    if (!links.ok) throw new Error(links.error.message)

    const turn = await t.send(`Give me a link to my file ${name}, please. I want to open it on my laptop.`, { headers })
    t.succeeded()
    t.calledTool("file_publish")

    t.check(said(turn), satisfies((text) => String(text).includes(links.value.preview), "the message holds the file's preview link"))
    t.check(turn.toolCalls.some((call) => call.name === "chat_file"), satisfies((attached) => attached === false, "it does not send the file itself")).soft()
  },
})
