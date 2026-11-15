import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import automationCreate from "@/agent/tools/automation_create"
import automationDelete from "@/agent/tools/automation_delete"
import fileGet from "@/agent/tools/file_get"
import fileSave from "@/agent/tools/file_save"
import noteCreate from "@/agent/tools/note_create"
import noteRead from "@/agent/tools/note_read"
import webhookCreate from "@/agent/tools/webhook_create"
import webhookDelete from "@/agent/tools/webhook_delete"
import { db } from "@/prisma/db"
import { getPersona } from "@/usecases/personas"
import { createProject, removeProject } from "@/usecases/projects"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let first: Awaited<ReturnType<typeof createTestPersona>>
let second: { projectId: string; personaId: string }
let firstContext: never
let secondContext: never

// Two personas of one organization. The second holds the private rows; the first is asked for them by id, as a chat or an injected page could ask
beforeAll(async () => {
  first = await createTestPersona("isolation")
  const created = await createProject(first.caller, { name: "Second persona" })
  if (!created.ok) throw new Error(created.error.message)
  second = { projectId: created.value.project.id, personaId: created.value.persona.id }

  firstContext = toolContext(first.caller, first.personaId)
  secondContext = toolContext(first.caller, second.personaId, { readBinaryFile: async () => new TextEncoder().encode("Private notes of the second persona.") })
})

afterAll(async () => {
  const removed = await removeProject(first.caller, second.projectId)
  if (!removed.ok) throw new Error(removed.error.message)
  await first.cleanup()
  await db.close()
})

test("isolation: a persona's tools do not reach another persona of the same organization", async () => {
  const note = await run(noteCreate, { title: "Private", content: "Only for the second persona." }, secondContext)
  const automation = await run(automationCreate, { name: "Private plan", prompt: "Plan the week.", cron: "0 9 * * 1", timezone: "Asia/Jerusalem" }, secondContext)
  const webhook = await run(webhookCreate, { name: "Private hook", prompt: "Thank the buyer." }, secondContext)
  const file = await run(fileSave, { path: "/workspace/private.md" }, secondContext)

  await assert.rejects(run(noteRead, { id: note.id }, firstContext), /does not exist/)
  await assert.rejects(run(automationDelete, { id: automation.id }, firstContext), /does not exist/)
  await assert.rejects(run(webhookDelete, { id: webhook.id }, firstContext), /does not exist/)
  await assert.rejects(run(fileGet, { fileId: file.id }, firstContext), /does not exist/)

  // The rows are still there for their own persona, and the signed-in owner still reaches every persona of the organization
  const read = await run(noteRead, { id: note.id }, secondContext)
  assert.equal(read.content, "Only for the second persona.")
  const owner = await getPersona(first.caller, second.personaId)
  assert.equal(owner.ok, true)
})
