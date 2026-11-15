import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker } from "@/evals/shared"
import { listFiles } from "@/usecases/files"

// Asked for a document as a file, the persona writes it, keeps it in its files and sends that file itself
export default defineEval<typeof config>({
  description: "Asked for a short document as a file, the persona saves it to its files and sends it with chat_file.",
  tags: ["files"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const name = marker("packing")

    const turn = await t.send(`Write me a short packing list for a weekend at the beach, save it as a file named ${name}.md, and send me the file.`, { headers })
    t.succeeded()
    t.calledTool("file_save")

    const files = await listFiles(caller, personaId)
    const file = files.ok ? files.value.find((item) => item.name.startsWith(name)) : undefined
    await t.require(file, satisfies((value) => value !== undefined, "the files hold the new file"))
    const sent = turn.toolCalls.find((call) => call.name === "chat_file")
    t.check(sent?.input.fileId, satisfies((id) => id === file?.id, "it sends that file with chat_file"))
  },
})
