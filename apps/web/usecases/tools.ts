import { z } from "zod"

import { ok, validate } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const tool = z.object({
  enabled: z.boolean().default(true)
}).prefault({})

const tools = z.object({
  automation_create: tool,
  automation_delete: tool,
  automation_list: tool,
  automation_runs: tool,
  automation_update: tool,
  browser_close: tool,
  browser_list: tool,
  browser_task: tool,
  file_delete: tool,
  file_get: tool,
  file_list: tool,
  file_publish: tool,
  file_read: tool,
  file_save: tool,
  file_unpublish: tool,
  file_update: tool,
  instruction_delete: tool,
  instruction_list: tool,
  instruction_save: tool,
  instruction_toggle: tool,
  mcp_delete: tool,
  mcp_list: tool,
  mcp_save: tool,
  mcp_toggle: tool,
  media_image_create: tool,
  media_image_edit: tool,
  media_read: tool,
  media_speech: tool,
  media_transcribe: tool,
  media_video: tool,
  model_list: tool,
  model_me: tool,
  model_set: tool,
  note_create: tool,
  note_delete: tool,
  note_read: tool,
  note_search: tool,
  note_update: tool,
  skill_delete: tool,
  skill_save: tool,
  skill_toggle: tool,
  trigger_create: tool,
  trigger_delete: tool,
  trigger_list: tool,
  trigger_types: tool,
  trigger_update: tool,
  vault_create: tool,
  vault_delete: tool,
  vault_link: tool,
  vault_list: tool,
  vault_load: tool,
  webhook_create: tool,
  webhook_delete: tool,
  webhook_list: tool,
  webhook_update: tool,
})

const toolName = tools.keyof()
const updateInput = z.object({ enabled: z.boolean() })

export async function listTools(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const rows = await db.orm.public.Tool.where({ personaId }).all()
  const saved = Object.fromEntries(rows.map((row) => [row.name, { enabled: row.enabled }]))
  const result = tools.parse(saved)
  return ok(result)
}

export async function updateTool(caller: Caller, personaId: string, name: string, input: z.input<typeof updateInput>) {
  const named = validate(toolName, name)
  if (!named.ok) return named

  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  await db.orm.public.Tool.upsert({
    create: { personaId, name: named.value, enabled: parsed.value.enabled },
    update: { enabled: parsed.value.enabled },
    conflictOn: { personaId, name: named.value }
  })

  const result = await listTools(caller, personaId)
  return result
}