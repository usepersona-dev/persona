import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { getFileLinks, updateFile } from "@/usecases/files"

export const filePublish = (deferred = false) => defineTool({
  deferred,
  description: "Make files public, so anyone with their links can open them; say so when you send a link. Send people the preview; a web page shows other files by their url, so publish the page and the files it shows together. Take the ids from file_list.",
  inputSchema: z.object({ fileIds: z.array(z.string().min(1)).min(1) }),
  label: { start: ({ fileIds }) => (fileIds.length === 1 ? "Publish a file" : `Publish ${fileIds.length} files`) },
  async execute({ fileIds }, ctx) {
    const { caller } = readCaller(ctx)

    const files = await Promise.all(fileIds.map(async (fileId) => {
      const published = await updateFile(caller, fileId, { public: true })
      if (!published.ok) throw new Error(published.error.message)
      const links = await getFileLinks(caller, fileId)
      if (!links.ok) throw new Error(links.error.message)
      return { fileId, ...links.value }
    }))

    const result = { files }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.file
  if (!family.enabled) return null
  return filePublish(family.deferred)
})
