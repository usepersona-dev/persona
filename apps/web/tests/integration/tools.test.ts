import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import { db } from "@/prisma/db"
import { createTestPersona } from "@/tests/helpers"
import { duplicatePersona } from "@/usecases/personas"
import { listTools, updateTool } from "@/usecases/tools"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let stranger: Awaited<ReturnType<typeof createTestPersona>>

beforeAll(async () => {
  persona = await createTestPersona("tools")
  stranger = await createTestPersona("tools-stranger")
})

afterAll(async () => {
  await persona.cleanup()
  await stranger.cleanup()
  await db.close()
})

test("tools: every family starts switched on and in the list", async () => {
  const listed = await listTools(persona.caller, persona.personaId)
  if (!listed.ok) throw new Error(listed.error.message)

  const families = Object.values(listed.value)
  assert.equal(families.every((family) => family.enabled && !family.deferred), true)
})

test("tools: a change touches only the field it names, and only that family", async () => {
  const off = await updateTool(persona.caller, persona.personaId, "note", { enabled: false })
  if (!off.ok) throw new Error(off.error.message)
  assert.deepEqual(off.value.note, { enabled: false, deferred: false })

  const deferred = await updateTool(persona.caller, persona.personaId, "note", { deferred: true })
  if (!deferred.ok) throw new Error(deferred.error.message)
  assert.deepEqual(deferred.value.note, { enabled: false, deferred: true })

  const on = await updateTool(persona.caller, persona.personaId, "note", { enabled: true })
  if (!on.ok) throw new Error(on.error.message)
  assert.deepEqual(on.value.note, { enabled: true, deferred: true })
  assert.deepEqual(on.value.file, { enabled: true, deferred: false })
})

test("tools: a name that is not a family and another organization's persona are refused", async () => {
  const tool = await updateTool(persona.caller, persona.personaId, "note_create", { enabled: false })
  assert.equal(tool.ok, false)
  const chat = await updateTool(persona.caller, persona.personaId, "chat", { enabled: false })
  assert.equal(chat.ok, false)

  const changed = await updateTool(stranger.caller, persona.personaId, "vault", { enabled: false })
  assert.equal(changed.ok, false)
  const read = await listTools(stranger.caller, persona.personaId)
  assert.equal(read.ok, false)

  const listed = await listTools(persona.caller, persona.personaId)
  if (!listed.ok) throw new Error(listed.error.message)
  assert.deepEqual(listed.value.vault, { enabled: true, deferred: false })
})

test("tools: a copy of the persona keeps its switches", async () => {
  const set = await updateTool(persona.caller, persona.personaId, "browser", { enabled: false, deferred: true })
  if (!set.ok) throw new Error(set.error.message)

  const copy = await duplicatePersona(persona.caller, persona.personaId)
  if (!copy.ok) throw new Error(copy.error.message)

  const listed = await listTools(persona.caller, copy.value.id)
  if (!listed.ok) throw new Error(listed.error.message)
  assert.deepEqual(listed.value.browser, { enabled: false, deferred: true })
  assert.deepEqual(listed.value.webhook, { enabled: true, deferred: false })
})
