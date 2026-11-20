import { z } from "zod"

import { ok, validate } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const config = z.object({
  enabled: z.boolean().default(true),
  deferred: z.boolean().default(false)
}).prefault({})

const tools = z.object({
  apps: config,
  automation: config,
  browser: config,
  file: config,
  instruction: config,
  mcp: config,
  media_audio: config,
  media_images: config,
  media_read: config,
  media_video: config,
  model: config,
  note: config,
  skill: config,
  trigger: config,
  vault: config,
  webhook: config,
})

export type Tools = z.output<typeof tools>

const familyName = tools.keyof()

const updateInput = z.object({
  enabled: z.boolean().optional(),
  deferred: z.boolean().optional()
})

export async function listTools(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const rows = await db.orm.public.Tool.where({ personaId }).all()
  const saved = Object.fromEntries(rows.map((row) => [row.name, { enabled: row.enabled, deferred: row.deferred }]))
  const result = tools.parse(saved)
  return ok(result)
}

export async function updateTool(caller: Caller, personaId: string, name: string, input: z.input<typeof updateInput>) {
  const named = validate(familyName, name)
  if (!named.ok) return named

  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  await db.orm.public.Tool.upsert({
    create: { personaId, name: named.value, ...parsed.value },
    update: parsed.value,
    conflictOn: { personaId, name: named.value }
  })

  const result = await listTools(caller, personaId)
  return result
}
