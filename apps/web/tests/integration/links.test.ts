import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import { db } from "@/prisma/db"
import { createTestPersona } from "@/tests/helpers"
import { listLinks, updateLink } from "@/usecases/links"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let stranger: Awaited<ReturnType<typeof createTestPersona>>
let chat: { channel: "telegram"; line: string; externalId: string }

beforeAll(async () => {
  persona = await createTestPersona("links")
  stranger = await createTestPersona("links-stranger")
  chat = { channel: "telegram", line: "111", externalId: `links-${Date.now()}` }
  await db.orm.public.Link.create({ ...chat, personaId: persona.personaId })
})

afterAll(async () => {
  await persona.cleanup()
  await stranger.cleanup()
  await db.close()
})

test("a chat gets reports from the start, and its creator turns them off and on", async () => {
  const listed = await listLinks(persona.caller, persona.personaId)
  if (!listed.ok) throw new Error(listed.error.message)
  assert.equal(listed.value[0]?.reports, true)

  const off = await updateLink(persona.caller, chat, { reports: false })
  if (!off.ok) throw new Error(off.error.message)
  assert.equal(off.value.reports, false)

  const on = await updateLink(persona.caller, chat, { reports: true })
  if (!on.ok) throw new Error(on.error.message)
  assert.equal(on.value.reports, true)
})

test("a change that is not on or off is refused, and so is one from another organization", async () => {
  const wrong = await updateLink(persona.caller, chat, { reports: "no" as never })
  assert.equal(wrong.ok, false)

  const other = await updateLink(stranger.caller, chat, { reports: false })
  assert.equal(other.ok, false)

  const listed = await listLinks(persona.caller, persona.personaId)
  if (!listed.ok) throw new Error(listed.error.message)
  assert.equal(listed.value[0]?.reports, true)
})
