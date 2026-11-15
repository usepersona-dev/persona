import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { removeNote } from "@/usecases/notes"

export default defineTool({
  description: "Delete a note for good.",
  inputSchema: z.object({ id: z.string().min(1) }),
  label: { start: () => "Delete note" },
  async execute({ id }, ctx) {
    const { caller } = readCaller(ctx)

    const removed = await removeNote(caller, id)
    if (!removed.ok) throw new Error(removed.error.message)

    const result = { id, deleted: true }
    return result
  },
})
