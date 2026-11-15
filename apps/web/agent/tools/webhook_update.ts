import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { updateWebhook } from "@/usecases/webhooks"

export default defineTool({
  description: "Change a webhook: its name, its task, or whether it takes calls at all. To stop one without losing it, set enabled to false.",
  inputSchema: z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(80).optional(),
    prompt: z.string().trim().min(1).max(20_000).optional(),
    enabled: z.boolean().optional(),
  }),
  label: { start: () => "Update webhook" },
  async execute({ id, ...changes }, ctx) {
    const { caller } = readCaller(ctx)

    const updated = await updateWebhook(caller, id, changes)
    if (!updated.ok) throw new Error(updated.error.message)
    const webhook = updated.value

    const url = new URL(`/eve/v1/webhooks/${webhook.secret}`, process.env.APP_URL).toString()
    const result = { id: webhook.id, name: webhook.name, url, enabled: webhook.enabled }
    return result
  },
})
