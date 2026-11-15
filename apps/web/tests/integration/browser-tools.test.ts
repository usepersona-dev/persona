import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"
import { setTimeout as sleep } from "node:timers/promises"

import browserClose from "@/agent/tools/browser_close"
import browserList from "@/agent/tools/browser_list"
import { deleteProfile, findProfile, getRun } from "@/lib/browser-use"
import { db } from "@/prisma/db"
import { createBrowserWithTask, getBrowserAndTask, removeBrowserAndTask, updateBrowserAndTask } from "@/usecases/browser-use"
import { addCredential, readVaultSecrets, setCredentialValues } from "@/usecases/vault"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never

beforeAll(async () => {
  persona = await createTestPersona("browser-tools")
  context = toolContext(persona.caller, persona.personaId)
})

afterAll(async () => {
  try {
    const browsers = await db.orm.public.Browser.where({ personaId: persona.personaId }).all()
    await Promise.all(browsers.map((browser) => removeBrowserAndTask(persona.caller, persona.personaId, browser.id)))
    const profile = await findProfile(persona.personaId)
    if (profile) await deleteProfile(profile.id)
  } finally {
    await persona.cleanup()
    await db.close()
  }
})

test("browser: signs in with a vault login it never sees, takes a change of mind on the same page, then closes", async () => {
  const password = `swordfish-${Math.random().toString(36).slice(2, 10)}`
  const added = await addCredential(persona.caller, persona.personaId, { title: "Quotes login", description: "The login for quotes.toscrape.com.", fields: [{ name: "username", secret: false }, { name: "password", secret: true }] })
  assert.ok(added.ok)
  const filled = await setCredentialValues(persona.caller, added.value.id, { username: "reader", password })
  assert.ok(filled.ok)

  const unknown = "00000000-0000-0000-0000-000000000000"
  const secrets = await readVaultSecrets(persona.caller, persona.personaId, [added.value.id, unknown])
  assert.ok(secrets.ok)
  assert.deepEqual(secrets.value.found.map((secret) => secret.id), [added.value.id])
  assert.deepEqual(secrets.value.missing, [unknown])

  const vault = [{ credentialId: added.value.id, sites: ["quotes.toscrape.com"] }]
  const opened = await createBrowserWithTask(persona.caller, persona.personaId, { task: "Sign in at https://quotes.toscrape.com/login with the Quotes login, then tell me what the link at the top right of the page says.", vault }, secrets.value.found)
  assert.ok(opened.ok)
  const { id, runId } = opened.value

  const signedIn = await waitForAnswer(id, runId)
  assert.equal(signedIn.status, "Done", signedIn.message)
  assert.match(signedIn.message, /logout/i)
  const sent = await getRun(runId)
  assert.match(sent.task, /password as vault1_2/)
  assert.doesNotMatch(sent.task, new RegExp(password))

  const listed = await run(browserList, {}, context)
  assert.deepEqual(listed.browsers.map((browser) => [browser.id, browser.working]), [[id, false]])
  assert.ok(listed.browsers.every((browser) => !("link" in browser)), "the list holds no live link: the person sees the browser only on a takeover")

  const long = await updateBrowserAndTask(persona.caller, persona.personaId, id, { task: "Go through every page of quotes on this site, one by one, and count all the quotes." })
  assert.ok(long.ok)
  await sleep(5000)
  const changed = await updateBrowserAndTask(persona.caller, persona.personaId, id, { task: "Drop that. Just tell me who wrote the first quote on https://quotes.toscrape.com." })
  assert.ok(changed.ok)
  const stopped = await waitForAnswer(id, long.value.runId)
  assert.equal(stopped.status, "Stopped", stopped.message)
  const author = await waitForAnswer(id, changed.value.runId)
  assert.equal(author.status, "Done", author.message)
  assert.match(author.message, /Einstein/)

  const closed = await run(browserClose, { browserId: id }, context)
  assert.deepEqual(closed, { browserId: id, closed: true })
  const empty = await run(browserList, {}, context)
  assert.deepEqual(empty.browsers, [])
})

test("browser: a browser that isn't the persona's is out of reach", async () => {
  await assert.rejects(run(browserClose, { browserId: "00000000-0000-0000-0000-000000000000" }, context), /closed/)
})

async function waitForAnswer(browserId: string, runId: string) {
  for (let check = 0; check < 90; check++) {
    const answer = await getBrowserAndTask(persona.caller, persona.personaId, browserId, runId, null)
    assert.ok(answer.ok)
    if (answer.value.status !== "Working") return answer.value
    await sleep(2000)
  }
  throw new Error("The browser did not answer within 3 minutes.")
}
