import { handler, readJson } from "@/app/api/handler"
import { removeWebhook, updateWebhook } from "@/usecases/webhooks"

type Params = { webhookId: string }

export const PATCH = handler<Params>(async (caller, { webhookId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const webhook = await updateWebhook(caller, webhookId, input.value)
  return webhook
})

export const DELETE = handler<Params>(async (caller, { webhookId }) => {
  const removed = await removeWebhook(caller, webhookId)
  return removed
})
