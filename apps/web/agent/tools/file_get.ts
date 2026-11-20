import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { getFile, getFileLinks } from "@/usecases/files"

export const fileGet = (deferred = false) => defineTool({
  deferred,
  description: "Get the links of one of your files, which open for anyone only while the file is public: preview is the page to send people; url is the file itself, for inside a web page. Take the id from file_list.",
  inputSchema: z.object({ fileId: z.string().min(1) }),
  label: { start: () => "Get a file's links" },
  async execute({ fileId }, ctx) {
    const { caller } = readCaller(ctx)

    const file = await getFile(caller, fileId)
    if (!file.ok) throw new Error(file.error.message)
    const links = await getFileLinks(caller, fileId)
    if (!links.ok) throw new Error(links.error.message)

    const result = { fileId, public: file.value.public, ...links.value }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.file
  if (!family.enabled) return null
  return fileGet(family.deferred)
})
