import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { called, marker, said } from "@/evals/shared"
import { getFileLinks, saveFile } from "@/usecases/files"

// Asked for a link to a file, the persona publishes it and writes its link in a message, instead of sending the file. A published file opens for anyone with the link, so the persona may ask first and publish on a yes
export default defineEval<typeof config>({
  description: "Asked for a link to one of its files, the persona publishes it with file_publish, at once or after a yes, and sends the link with chat_say instead of the file.",
  tags: ["chat"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const name = `${marker("plan")}.md`
    const saved = await saveFile(caller, personaId, { name, contentType: "text/markdown", bytes: new TextEncoder().encode("# Plan\n\nWeek one: rest.") })
    if (!saved.ok) throw new Error(saved.error.message)
    const links = await getFileLinks(caller, saved.value.id)
    if (!links.ok) throw new Error(links.error.message)

    const asked = await t.send(`Give me a link to my file ${name}, please. I want to open it on my laptop.`, { headers })
    const turn = called(asked).includes("file_publish") ? asked : await asked.session.send("Yes, go ahead.", { headers })
    t.succeeded()

    t.check(called(turn).includes("file_publish"), satisfies((value) => value === true, "it publishes the file, at once or after a yes"))
    t.check(said(turn), satisfies((text) => String(text).includes(links.value.preview), "the message holds the file's preview link"))

    const attached = called(asked).includes("chat_file") || called(turn).includes("chat_file")
    t.check(attached, satisfies((value) => value === false, "it does not send the file itself")).soft()
  },
})
