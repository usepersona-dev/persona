import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { updateFile } from "@/usecases/files"

export const fileUnpublish = (deferred = false) => defineTool({
  deferred,
  description: "Make files private again: their links stop working. Take the ids from file_list.",
  inputSchema: z.object({ fileIds: z.array(z.string().min(1)).min(1) }),
  label: { start: ({ fileIds }) => (fileIds.length === 1 ? "Unpublish a file" : `Unpublish ${fileIds.length} files`) },
  async execute({ fileIds }, ctx) {
    const { caller } = readCaller(ctx)

    await Promise.all(fileIds.map(async (fileId) => {
      const unpublished = await updateFile(caller, fileId, { public: false })
      if (!unpublished.ok) throw new Error(unpublished.error.message)
    }))

    const result = { fileIds, public: false }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.file
  if (!family.enabled) return null
  return fileUnpublish(family.deferred)
})
