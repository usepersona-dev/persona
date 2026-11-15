import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import instructionDelete from "@/agent/tools/instruction_delete"
import instructionList from "@/agent/tools/instruction_list"
import instructionSave from "@/agent/tools/instruction_save"
import instructionToggle from "@/agent/tools/instruction_toggle"
import mcpDelete from "@/agent/tools/mcp_delete"
import mcpList from "@/agent/tools/mcp_list"
import mcpSave from "@/agent/tools/mcp_save"
import mcpToggle from "@/agent/tools/mcp_toggle"
import modelList from "@/agent/tools/model_list"
import modelMe from "@/agent/tools/model_me"
import modelSet from "@/agent/tools/model_set"
import skillDelete from "@/agent/tools/skill_delete"
import skillSave from "@/agent/tools/skill_save"
import skillToggle from "@/agent/tools/skill_toggle"
import { db } from "@/prisma/db"
import { listSkills } from "@/usecases/skills"
import { getPersona } from "@/usecases/personas"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never

beforeAll(async () => {
  persona = await createTestPersona("setup-tools")
  context = toolContext(persona.caller, persona.personaId)
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

test("instructions: save, revise by name, turn off, delete", async () => {
  await run(instructionSave, { name: "Language", content: "Answer in Spanish." }, context)
  await run(instructionSave, { name: "Language", content: "Answer in Hebrew." }, context)
  await run(instructionToggle, { name: "Language", enabled: false }, context)

  const listed = await run(instructionList, {}, context)
  assert.deepEqual(listed.instructions, [{ name: "Language", content: "Answer in Hebrew.", enabled: false }])

  await run(instructionDelete, { name: "Language" }, context)
  const emptied = await run(instructionList, {}, context)
  assert.equal(emptied.instructions.length, 0)
  await assert.rejects(run(instructionToggle, { name: "Language", enabled: true }, context), /no instruction named/)
})

test("skills: save with a file, revise by name, turn off, delete", async () => {
  await run(skillSave, { name: "plan-week", description: "Use when planning a week.", markdown: "Plan Monday first.", files: [{ path: "references/days.md", contents: "Mon to Sun" }] }, context)
  await run(skillSave, { name: "plan-week", description: "Use when planning a week.", markdown: "Plan Sunday first." }, context)
  await run(skillToggle, { name: "plan-week", enabled: false }, context)

  const skills = await listSkills(persona.caller, persona.personaId)
  assert.ok(skills.ok)
  assert.equal(skills.value.length, 1)
  assert.equal(skills.value[0].enabled, false)

  await run(skillDelete, { name: "plan-week" }, context)
  const emptied = await listSkills(persona.caller, persona.personaId)
  assert.ok(emptied.ok)
  assert.equal(emptied.value.length, 0)
})

test("mcp servers: save with a secret header, list shows header names only, turn off, delete", async () => {
  await run(mcpSave, { name: "deepwiki", url: "https://mcp.deepwiki.com/mcp", description: "Docs about GitHub repositories.", headers: { Authorization: "Bearer secret-value" } }, context)
  await run(mcpToggle, { name: "deepwiki", enabled: false }, context)

  const listed = await run(mcpList, {}, context)
  assert.deepEqual(listed.servers, [{ name: "deepwiki", url: "https://mcp.deepwiki.com/mcp", description: "Docs about GitHub repositories.", enabled: false, headers: ["Authorization"] }])
  assert.doesNotMatch(JSON.stringify(listed), /secret-value/)
  await assert.rejects(run(mcpSave, { name: "apps", url: "https://example.com/mcp", description: "Taken." }, context), /Persona uses this name/)

  await run(mcpDelete, { name: "deepwiki" }, context)
  const emptied = await run(mcpList, {}, context)
  assert.equal(emptied.servers.length, 0)
})

test("models: list only models that can use tools, set one or a bundle, refuse a made-up one", async () => {
  const listed = await run(modelList, { search: "claude", sort: "newest" }, context)
  assert.ok(listed.models.length > 0)
  assert.ok(listed.models.length <= 20)
  assert.ok(listed.models.every((model) => model.tags.includes("tool-use")))

  const [first, second] = listed.models.map((model) => model.id)
  await run(modelSet, { models: [{ model: first, when: "Every task" }] }, context)
  const mine = await run(modelMe, {}, context)
  assert.deepEqual(mine.models, [{ model: first, when: "Every task" }])
  await assert.rejects(run(modelSet, { models: [{ model: first, when: "" }] }, context), /Say when to use each model/)

  await run(modelSet, { models: [{ model: first, when: "Hard tasks" }, { model: second, when: "Quick replies" }] }, context)
  const updated = await getPersona(persona.caller, persona.personaId)
  assert.ok(updated.ok)
  assert.equal(updated.value.models.length, 2)

  await assert.rejects(run(modelSet, { models: [{ model: first, when: "" }, { model: second, when: "" }] }, context), /Say when to use each model/)
  await assert.rejects(run(modelSet, { models: [{ model: "nobody/no-such-model", when: "" }] }, context), /isn't one of the models you can run on/)
})
