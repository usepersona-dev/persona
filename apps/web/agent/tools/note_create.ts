import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { addNote } from "@/usecases/notes"

export default defineTool({
  description: "Write a note to keep: anything you want to remember, track or come back to, such as a list, a draft or something the person told you. note_search finds it again.",
  inputSchema: z.object({
    title: z.string().trim().min(1).max(200).describe("A short title that tells it apart from your other notes."),
    content: z.string().max(100_000).describe("The note itself."),
  }),
  label: { start: ({ title }) => `Write note ${title}` },
  async execute({ title, content }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const added = await addNote(caller, personaId, { title, content })
    if (!added.ok) throw new Error(added.error.message)

    const result = { id: added.value.id, title: added.value.title }
    return result
  },
})
