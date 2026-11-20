import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { updateFile } from "@/usecases/files"

export const fileUpdate = (deferred = false) => defineTool({
  deferred,
  description: "Rename one of your files. Take the id from file_list.",
  inputSchema: z.object({ fileId: z.string().min(1), name: z.string().min(1).describe("The new name.") }),
  label: { start: () => "Rename a file" },
  async execute({ fileId, name }, ctx) {
    const { caller } = readCaller(ctx)

    const updated = await updateFile(caller, fileId, { name })
    if (!updated.ok) throw new Error(updated.error.message)

    const result = { fileId, name: updated.value.name }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.file
  if (!family.enabled) return null
  return fileUpdate(family.deferred)
})
