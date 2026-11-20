import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { searchNotes } from "@/usecases/notes"

export const noteSearch = (deferred = false) => defineTool({
  deferred,
  description: "Find your notes by words in their title or text, newest first; with no query it lists the latest. Each result shows how the note starts; note_read gives the whole text.",
  inputSchema: z.object({
    query: z.string().trim().max(200).optional().describe("Words the note should have, such as dentist or groceries."),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  label: { start: ({ query }) => (query ? `Search notes for ${query}` : "List notes") },
  async execute({ query, limit }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const found = await searchNotes(caller, personaId, { query, limit })
    if (!found.ok) throw new Error(found.error.message)

    const result = { notes: found.value.map((note) => ({ id: note.id, title: note.title, start: note.content.slice(0, 200), updatedAt: note.updatedAt })) }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.note
  if (!family.enabled) return null
  return noteSearch(family.deferred)
})
