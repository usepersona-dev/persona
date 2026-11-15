import { handler, readJson } from "@/app/api/handler"
import { createWebhook, listWebhooks } from "@/usecases/webhooks"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const webhooks = await listWebhooks(caller, personaId)
  return webhooks
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const webhook = await createWebhook(caller, personaId, input.value)
  return webhook
})
