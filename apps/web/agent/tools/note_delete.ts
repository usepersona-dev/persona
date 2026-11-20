import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { removeNote } from "@/usecases/notes"

export const noteDelete = (deferred = false) => defineTool({
  deferred,
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

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.note
  if (!family.enabled) return null
  return noteDelete(family.deferred)
})
