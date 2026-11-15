import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import automationCreate from "@/agent/tools/automation_create"
import automationDelete from "@/agent/tools/automation_delete"
import automationList from "@/agent/tools/automation_list"
import automationRuns from "@/agent/tools/automation_runs"
import automationUpdate from "@/agent/tools/automation_update"
import { db } from "@/prisma/db"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never

beforeAll(async () => {
  persona = await createTestPersona("automation-tools")
  context = toolContext(persona.caller, persona.personaId)
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

test("automations: create, list, update, read runs, delete", async () => {
  const created = await run(automationCreate, { name: "Monday plan", prompt: "Plan the week.", cron: "0 9 * * 1", timezone: "Asia/Jerusalem" }, context)
  assert.equal(created.cron, "0 9 * * 1")
  assert.equal(created.enabled, true)

  await run(automationUpdate, { id: created.id, enabled: false }, context)
  const listed = await run(automationList, {}, context)
  assert.equal(listed.automations.length, 1)
  assert.equal(listed.automations[0].enabled, false)

  const runs = await run(automationRuns, { id: created.id }, context)
  assert.deepEqual(runs.runs, [])

  await run(automationDelete, { id: created.id }, context)
  const emptied = await run(automationList, {}, context)
  assert.equal(emptied.automations.length, 0)
})

test("automations: a one-time run must be in the future and needs at or cron", async () => {
  await assert.rejects(run(automationCreate, { name: "Past", prompt: "Too late.", at: "2020-01-01T09:00:00+00:00" }, context), /future/)
  await assert.rejects(run(automationCreate, { name: "None", prompt: "Never starts." }, context), /one-time date, a repeating schedule, or both/)
})

test("automations: an unknown automation is refused", async () => {
  await assert.rejects(run(automationUpdate, { id: "00000000-0000-0000-0000-000000000000", enabled: false }, context), /does not exist/)
  await assert.rejects(run(automationDelete, { id: "00000000-0000-0000-0000-000000000000" }, context), /does not exist/)
})
