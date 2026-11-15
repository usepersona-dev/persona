import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { removeFile } from "@/usecases/files"

export default defineTool({
  description: "Delete one of your files for good. Take the id from file_list.",
  inputSchema: z.object({ fileId: z.string().min(1) }),
  label: { start: () => "Delete a file" },
  async execute({ fileId }, ctx) {
    const { caller } = readCaller(ctx)

    const removed = await removeFile(caller, fileId)
    if (!removed.ok) throw new Error(removed.error.message)

    const result = { fileId, deleted: true }
    return result
  },
})
