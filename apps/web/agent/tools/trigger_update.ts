import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { updateTrigger } from "@/usecases/triggers"

export default defineTool({
  description: "Change a trigger's name or task. To stop a trigger, delete it with trigger_delete.",
  inputSchema: z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(80).optional(),
    prompt: z.string().trim().min(1).max(20_000).optional(),
  }),
  label: { start: () => "Update trigger" },
  async execute({ id, ...changes }, ctx) {
    const { caller } = readCaller(ctx)

    const updated = await updateTrigger(caller, id, changes)
    if (!updated.ok) throw new Error(updated.error.message)
    const trigger = updated.value

    const result = { id: trigger.id, name: trigger.name, slug: trigger.slug }
    return result
  },
})
