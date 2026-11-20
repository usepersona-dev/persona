import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { readFile } from "@/usecases/files"

const FOLDER = "/workspace/files"

export const fileRead = (deferred = false) => defineTool({
  deferred,
  description: `Copy one of your files into your sandbox under ${FOLDER}, so you can open it with read_file or work on it with bash. It returns the path. Take the id from file_list.`,
  inputSchema: z.object({ fileId: z.string().min(1) }),
  label: { start: () => "Open a file" },
  async execute({ fileId }, ctx) {
    const { caller } = readCaller(ctx)

    const read = await readFile(caller, fileId)
    if (!read.ok) throw new Error(read.error.message)
    const content = read.value

    const path = `${FOLDER}/${toFileName(content.name)}`
    const sandbox = await ctx.getSandbox()
    await sandbox.writeBinaryFile({ path, content: content.bytes })

    const result = { path, name: content.name, contentType: content.contentType, size: content.size }
    return result
  },
})

function toFileName(name: string) {
  const safe = name.replace(/[/\\]/g, "_").replace(/^\.+/, "")
  const fileName = safe || "file"
  return fileName
}

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.file
  if (!family.enabled) return null
  return fileRead(family.deferred)
})
