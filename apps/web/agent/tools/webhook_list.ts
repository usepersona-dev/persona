import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listWebhooks } from "@/usecases/webhooks"

export const webhookList = (deferred = false) => defineTool({
  deferred,
  description: "List your webhooks, oldest first, with each one's id, task, URL and whether it is on.",
  inputSchema: z.object({}),
  label: { start: () => "List webhooks" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listWebhooks(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const webhooks = listed.value

    const result = { webhooks: webhooks.map((webhook) => ({ id: webhook.id, name: webhook.name, prompt: webhook.prompt, url: new URL(`/eve/v1/webhooks/${webhook.secret}`, process.env.APP_URL).toString(), enabled: webhook.enabled })) }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.webhook
  if (!family.enabled) return null
  return webhookList(family.deferred)
})
