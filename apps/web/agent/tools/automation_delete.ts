import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { removeAutomation } from "@/usecases/automations"

export default defineTool({
  description: "Delete an automation for good. Its runs stay, and one running right now still finishes. To stop one without losing it, set enabled to false with automation_update.",
  inputSchema: z.object({ id: z.string().min(1) }),
  label: { start: () => "Delete automation" },
  async execute({ id }, ctx) {
    const { caller } = readCaller(ctx)

    const removed = await removeAutomation(caller, id)
    if (!removed.ok) throw new Error(removed.error.message)

    const result = { id, deleted: true }
    return result
  },
})
