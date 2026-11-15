import { z } from "zod"

import { isValidCron, nextRunAt } from "@/lib/cron"
import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const name = z.string().trim().min(1, "Give the automation a name.").max(80, "Keep the name under 80 characters.")
const prompt = z.string().trim().min(1, "Write what the persona should do.").max(20_000, "Keep the prompt under 20,000 characters.")
const cron = z.string().trim().refine(isValidCron, "Use a schedule like \"0 9 * * 1\": minute, hour, day of the month, month, day of the week.")
const at = z.iso.datetime({ offset: true, error: "Use a full date and time." }).refine((value) => Date.parse(value) > Date.now(), "Pick a time in the future.").transform((value) => new Date(value).toISOString())
const timezone = z.string().trim().refine(isValidTimezone, "Pick a timezone from the list.")
const linkId = z.string().min(1)
const createInput = z.object({ name, prompt, cron: cron.nullable().optional(), at: at.nullable().optional(), timezone: timezone.optional(), linkId: linkId.optional() })
const updateInput = z.object({ name: name.optional(), prompt: prompt.optional(), cron: cron.nullable().optional(), at: at.nullable().optional(), timezone: timezone.optional(), enabled: z.boolean().optional(), linkId: linkId.nullable().optional() })
const runsInput = z.object({ limit: z.number().int().min(1).max(100).optional() })

export async function listAutomations(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const automations = await db.orm.public.Schedule.where({ personaId }).orderBy((schedule) => schedule.createdAt.asc()).all()
  return ok(automations)
}

export async function createAutomation(caller: Caller, personaId: string, input: z.input<typeof createInput>) {
  const parsed = validate(createInput, input)
  if (!parsed.ok) return parsed
  const { name, prompt, cron, at, timezone, linkId } = parsed.value

  const hasAt = Boolean(at)
  const hasCron = Boolean(cron)
  if (!hasAt && !hasCron) return err("invalid", "Set a one-time date, a repeating schedule, or both.")

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const when = { cron: cron ?? null, at: at ?? null, timezone: timezone ?? "UTC" }
  const automation = await db.orm.public.Schedule.create({ personaId, linkId: linkId ?? null, name, prompt, ...when, nextRunAt: nextRunAt(when, new Date()) })
  return ok(automation)
}

export async function updateAutomation(caller: Caller, automationId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed

  const automation = await findAutomation(caller, automationId)
  if (!automation.ok) return automation

  const changes = withoutUndefined(parsed.value)
  const after = { ...automation.value, ...changes }
  const hasAt = Boolean(after.at)
  const hasCron = Boolean(after.cron)
  if (!hasAt && !hasCron) return err("invalid", "Keep a one-time date, a repeating schedule, or both.")

  const next = nextRunAt(after, new Date())
  const updated = await db.orm.public.Schedule.where({ id: automationId }).update({ ...changes, nextRunAt: next })
  if (!updated) return err("not_found", "This automation does not exist.")

  return ok(updated)
}

export async function removeAutomation(caller: Caller, automationId: string) {
  const automation = await findAutomation(caller, automationId)
  if (!automation.ok) return automation

  await db.orm.public.Schedule.where({ id: automationId }).delete()
  return ok(undefined)
}

export async function listRuns(caller: Caller, automationId: string, input: z.input<typeof runsInput> = {}) {
  const parsed = validate(runsInput, input)
  if (!parsed.ok) return parsed
  const { limit } = parsed.value

  const automation = await findAutomation(caller, automationId)
  if (!automation.ok) return automation

  const runs = await db.orm.public.Run.where({ scheduleId: automationId }).orderBy((run) => run.scheduledFor.desc()).limit(limit ?? 50).all()
  return ok(runs)
}

async function findAutomation(caller: Caller, automationId: string) {
  const automation = await db.orm.public.Schedule.where({ id: automationId }).first()
  if (!automation) return err("not_found", "This automation does not exist.")

  const persona = await getPersona(caller, automation.personaId)
  if (!persona.ok) return err("not_found", "This automation does not exist.")

  return ok(automation)
}

function isValidTimezone(timezone: string): boolean {
  try {
    const format = new Intl.DateTimeFormat("en-US", { timeZone: timezone })
    const resolved = format.resolvedOptions().timeZone
    return resolved.length > 0
  } catch {
    return false
  }
}
