import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { updateNote } from "@/usecases/notes"

export default defineTool({
  description: "Change a note's title or text. The text you give replaces the old text, so include what should stay.",
  inputSchema: z.object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(100_000).optional(),
  }),
  label: { start: () => "Update note" },
  async execute({ id, title, content }, ctx) {
    const { caller } = readCaller(ctx)

    const updated = await updateNote(caller, id, { title, content })
    if (!updated.ok) throw new Error(updated.error.message)

    const result = { id: updated.value.id, title: updated.value.title }
    return result
  },
})
