import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { removeWebhook } from "@/usecases/webhooks"

export default defineTool({
  description: "Delete a webhook for good; its URL stops working. Its runs stay, and one running right now still finishes. To stop one without losing it, set enabled to false with webhook_update.",
  inputSchema: z.object({ id: z.string().min(1) }),
  label: { start: () => "Delete webhook" },
  async execute({ id }, ctx) {
    const { caller } = readCaller(ctx)

    const removed = await removeWebhook(caller, id)
    if (!removed.ok) throw new Error(removed.error.message)

    const result = { id, deleted: true }
    return result
  },
})
