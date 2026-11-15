import { z } from "zod"

import { deleteTrigger, getTriggerType, listAccounts, listTriggerTypes, registerTrigger } from "@/lib/composio"
import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const name = z.string().trim().min(1, "Give the trigger a name.").max(80, "Keep the name under 80 characters.")
const prompt = z.string().trim().min(1, "Write what to do with the events.").max(20_000, "Keep the prompt under 20,000 characters.")
const linkId = z.string().min(1)
const createInput = z.object({ name, prompt, linkId: linkId.optional(), slug: z.string().trim().min(1, "Name the trigger type."), config: z.record(z.string(), z.unknown()).optional(), accountId: z.string().min(1).optional() })
const updateInput = z.object({ name: name.optional(), prompt: prompt.optional(), linkId: linkId.nullable().optional() })

// The trigger types a connected app offers, with their settings
export async function listAppTriggers(caller: Caller, personaId: string, app: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const types = await listTriggerTypes(app.trim().toLowerCase())
  if (types.length === 0) return err("not_found", `${app} has no triggers.`)

  return ok(types)
}

export async function listTriggers(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const triggers = await db.orm.public.Trigger.where({ personaId }).orderBy((trigger) => trigger.createdAt.asc()).all()
  return ok(triggers)
}

// Sets the trigger on one of the persona's accounts of the trigger's app. Composio keeps one trigger per account, type and settings (defaults filled in),
// and creating returns the one that already has them: one of ours is refused, and one nothing holds (left over) is taken over
export async function createTrigger(caller: Caller, personaId: string, input: z.input<typeof createInput>) {
  const parsed = validate(createInput, input)
  if (!parsed.ok) return parsed
  const { name, prompt, linkId, slug, config, accountId } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const type = await getTriggerType(slug)
  if (!type) return err("invalid", `There is no trigger ${slug}. Look them up with trigger_types.`)

  const connected = await listAccounts(personaId)
  const accounts = connected.filter((account) => account.toolkit === type.toolkit)
  if (accounts.length === 0) return err("invalid", `Connect ${type.toolkit} first.`)
  if (!accountId && accounts.length > 1) return err("invalid", `Pick the account: ${accounts.map((account) => `${account.id} (${account.displayName ?? account.name})`).join(", ")}.`)

  const account = accountId ? accounts.find((item) => item.id === accountId) : accounts[0]
  if (!account) return err("invalid", `${accountId} is not one of the connected ${type.toolkit} accounts.`)

  const id = await registerTrigger(personaId, account.id, type.slug, config ?? {})
  const held = await db.orm.public.Trigger.where({ id }).first()
  if (held) return err("conflict", `Trigger "${held.name}" (${held.id}) already watches exactly this. Add the new task to its prompt with trigger_update.`)

  const trigger = await db.orm.public.Trigger.create({ id, personaId, linkId: linkId ?? null, name, prompt, slug: type.slug, accountId: account.id })
  return ok(trigger)
}

export async function updateTrigger(caller: Caller, triggerId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const changes = withoutUndefined(parsed.value)

  const trigger = await findTrigger(caller, triggerId)
  if (!trigger.ok) return trigger
  if (Object.keys(changes).length === 0) return ok(trigger.value)

  const updated = await db.orm.public.Trigger.where({ id: triggerId }).update(changes)
  if (!updated) return err("not_found", "This trigger does not exist.")

  return ok(updated)
}

export async function removeTrigger(caller: Caller, triggerId: string) {
  const trigger = await findTrigger(caller, triggerId)
  if (!trigger.ok) return trigger

  await deleteTrigger(triggerId).catch(() => undefined)
  await db.orm.public.Trigger.where({ id: triggerId }).delete()
  return ok(undefined)
}

async function findTrigger(caller: Caller, triggerId: string) {
  const trigger = await db.orm.public.Trigger.where({ id: triggerId }).first()
  if (!trigger) return err("not_found", "This trigger does not exist.")

  const persona = await getPersona(caller, trigger.personaId)
  if (!persona.ok) return err("not_found", "This trigger does not exist.")

  return ok(trigger)
}
