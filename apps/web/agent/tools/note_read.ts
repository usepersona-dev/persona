import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { getNote } from "@/usecases/notes"

export const noteRead = (deferred = false) => defineTool({
  deferred,
  description: "Read a note's whole text.",
  inputSchema: z.object({ id: z.string().min(1) }),
  label: { start: () => "Read note" },
  async execute({ id }, ctx) {
    const { caller } = readCaller(ctx)

    const note = await getNote(caller, id)
    if (!note.ok) throw new Error(note.error.message)

    const result = { id: note.value.id, title: note.value.title, content: note.value.content, updatedAt: note.value.updatedAt }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.note
  if (!family.enabled) return null
  return noteRead(family.deferred)
})
