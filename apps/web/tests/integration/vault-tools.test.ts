import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import { vaultCreate } from "@/agent/tools/vault_create"
import { vaultLink } from "@/agent/tools/vault_link"
import { vaultList } from "@/agent/tools/vault_list"
import { vaultLoad } from "@/agent/tools/vault_load"
import { db } from "@/prisma/db"
import { openCollectLink, setCredentialValues } from "@/usecases/vault"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never
const written: { path: string; content: string }[] = []

beforeAll(async () => {
  persona = await createTestPersona("vault-tools")
  context = toolContext(persona.caller, persona.personaId, { writeTextFile: async (file) => void written.push(file) })
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

test("vault: set up a credential, fill it, list it without values, link it, load only its env-named fields into the sandbox", async () => {
  const created = await run(vaultCreate(), { title: "Gym login", description: "Use when booking a class.", fields: [{ name: "email", secret: false }, { name: "GYM_API_KEY", secret: true }] }, context)
  assert.match(created.link, new RegExp(`^${process.env.APP_URL}/collect/`))
  const empty = await run(vaultList(), {}, context)
  assert.deepEqual(empty.credentials[0].fields, [{ name: "email", secret: false, filled: false }, { name: "GYM_API_KEY", secret: true, filled: false }])

  const set = await setCredentialValues(persona.caller, created.id, { email: "dana@test.dev", GYM_API_KEY: "it's-s3cret" })
  assert.ok(set.ok)
  const filled = await run(vaultList(), {}, context)
  assert.ok(filled.credentials[0].fields.every((field) => field.filled))
  assert.doesNotMatch(JSON.stringify(filled), /s3cret|dana@test\.dev/)

  const link = await run(vaultLink(), { credentialId: created.id }, context)
  assert.match(link.url, /\/collect\//)
  const opened = await openCollectLink(link.url.split("/collect/")[1])
  assert.ok(opened.ok)
  assert.equal(opened.value.title, "Gym login")

  const loaded = await run(vaultLoad(), {}, context)
  assert.deepEqual(loaded.variables, ["GYM_API_KEY"])
  assert.doesNotMatch(JSON.stringify(loaded), /s3cret/)
  assert.equal(written[0].path, "/workspace/.vault.env")
  assert.equal(written[0].content, "export GYM_API_KEY='it'\\''s-s3cret'")
})

test("vault: another persona's credential is out of reach", async () => {
  await assert.rejects(run(vaultLink(), { credentialId: "00000000-0000-0000-0000-000000000000" }, context), /does not exist/)
})
