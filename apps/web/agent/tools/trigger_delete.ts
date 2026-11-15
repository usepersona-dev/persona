import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { removeTrigger } from "@/usecases/triggers"

export default defineTool({
  description: "Delete a trigger for good; the app stops sending its events. Its runs stay, and one running right now still finishes.",
  inputSchema: z.object({ id: z.string().min(1) }),
  label: { start: () => "Delete trigger" },
  async execute({ id }, ctx) {
    const { caller } = readCaller(ctx)

    const removed = await removeTrigger(caller, id)
    if (!removed.ok) throw new Error(removed.error.message)

    const result = { id, deleted: true }
    return result
  },
})
