import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const name = z.string().trim().min(1, "Give the webhook a name.").max(80, "Keep the name under 80 characters.")
const prompt = z.string().trim().min(1, "Write what to do with each call.").max(20_000, "Keep the prompt under 20,000 characters.")
const createInput = z.object({ name, prompt })
const updateInput = z.object({ name: name.optional(), prompt: prompt.optional(), enabled: z.boolean().optional() })

export async function listWebhooks(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const webhooks = await db.orm.public.Webhook.where({ personaId }).orderBy((webhook) => webhook.createdAt.asc()).all()
  const result = webhooks.map((webhook) => withUrl(webhook))
  return ok(result)
}

export async function createWebhook(caller: Caller, personaId: string, input: z.input<typeof createInput>) {
  const parsed = validate(createInput, input)
  if (!parsed.ok) return parsed
  const { name, prompt } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const webhook = await db.orm.public.Webhook.create({ personaId, name, prompt })
  const result = withUrl(webhook)
  return ok(result)
}

export async function updateWebhook(caller: Caller, webhookId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const changes = withoutUndefined(parsed.value)

  const webhook = await findWebhook(caller, webhookId)
  if (!webhook.ok) return webhook
  if (Object.keys(changes).length === 0) return ok(withUrl(webhook.value))

  const updated = await db.orm.public.Webhook.where({ id: webhookId }).update(changes)
  if (!updated) return err("not_found", "This webhook does not exist.")

  const result = withUrl(updated)
  return ok(result)
}

export async function removeWebhook(caller: Caller, webhookId: string) {
  const webhook = await findWebhook(caller, webhookId)
  if (!webhook.ok) return webhook

  await db.orm.public.Webhook.where({ id: webhookId }).delete()
  return ok(undefined)
}

// The address another app calls, with the webhook's secret in it. agent/channels/webhooks.ts takes the calls.
function withUrl<Row extends { secret: string }>(webhook: Row) {
  const result = { ...webhook, url: new URL(`/eve/v1/webhooks/${webhook.secret}`, process.env.APP_URL).toString() }
  return result
}

async function findWebhook(caller: Caller, webhookId: string) {
  const webhook = await db.orm.public.Webhook.where({ id: webhookId }).first()
  if (!webhook) return err("not_found", "This webhook does not exist.")

  const persona = await getPersona(caller, webhook.personaId)
  if (!persona.ok) return err("not_found", "This webhook does not exist.")

  return ok(webhook)
}
