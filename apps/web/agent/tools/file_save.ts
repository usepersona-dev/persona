import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { saveFile } from "@/usecases/files"
import { mediaTypeOf } from "@/usecases/media"

export default defineTool({
  description: "Save a file you made in your sandbox to your files and get back its id to send. your files stay, and you can open them again later with file_read.",
  inputSchema: z.object({
    path: z.string().min(1).describe("The file's path in the sandbox."),
    name: z.string().trim().min(1).max(255).optional().describe("The name to keep it under. Defaults to the file's name in the sandbox."),
  }),
  label: { start: ({ path }) => `Save ${path}` },
  async execute({ path, name }, ctx) {
    const { caller, personaId } = readCaller(ctx)
    const sandbox = await ctx.getSandbox()
    const bytes = await sandbox.readBinaryFile({ path })
    if (!bytes) throw new Error(`There is no file at ${path} in the sandbox.`)

    const fileName = name ?? path.split("/").pop() ?? path
    const saved = await saveFile(caller, personaId, { name: fileName, contentType: mediaTypeOf(fileName), bytes })
    if (!saved.ok) throw new Error(saved.error.message)
    const file = saved.value

    const result = { id: file.id, name: file.name, contentType: file.contentType, size: file.size }
    return result
  },
})
