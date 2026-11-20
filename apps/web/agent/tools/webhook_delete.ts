import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { removeWebhook } from "@/usecases/webhooks"

export const webhookDelete = (deferred = false) => defineTool({
  deferred,
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

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.webhook
  if (!family.enabled) return null
  return webhookDelete(family.deferred)
})
