import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { createWebhook } from "@/usecases/webhooks"

export const webhookCreate = (deferred = false) => defineTool({
  deferred,
  description: "Make yourself a webhook: a secret URL that another app or service can call, such as a form, a store or Zapier. Each call runs the task on its own, with the call's body attached as a file. Nobody will be there to explain the task when it runs, so write the prompt as the whole task. Give the URL only to the app that should call it.",
  inputSchema: z.object({
    name: z.string().trim().min(1).max(80).describe("A short title, such as New order, so it can be told apart from the others."),
    prompt: z.string().trim().min(1).max(20_000).describe("What to do with each call, written to yourself."),
  }),
  label: { start: ({ name }) => `Make webhook ${name}` },
  async execute({ name, prompt }, ctx) {
    const { caller, personaId, linkId } = readCaller(ctx)

    const created = await createWebhook(caller, personaId, { name, prompt, linkId })
    if (!created.ok) throw new Error(created.error.message)
    const webhook = created.value

    const url = new URL(`/eve/v1/webhooks/${webhook.secret}`, process.env.APP_URL).toString()
    const result = { id: webhook.id, name: webhook.name, url, enabled: webhook.enabled }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.webhook
  if (!family.enabled) return null
  return webhookCreate(family.deferred)
})
