import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { afterAll, beforeAll, test } from "vitest"

import triggers from "@/agent/channels/triggers"
import { db } from "@/prisma/db"
import { claimTriggerRuns, completeRun } from "@/usecases/runs"
import { createTestPersona } from "@/tests/helpers"

type Route = { method: string; path: string; handler: (request: Request, args: never) => Promise<Response> }

const SECRET = "test-trigger-secret"
const RUN_SECRET = "test-run-secret"
const SLUG = "GMAIL_NEW_GMAIL_MESSAGE"
const FIRST_EVENT = `msg_${crypto.randomUUID()}`
const AFTER_WINDOW_MS = 6 * 60_000

let persona: Awaited<ReturnType<typeof createTestPersona>>
let linkId: string
let triggerId: string
const sends: { target: unknown; message: unknown }[] = []
let failNextSend = false

// The trigger row is made directly: creating one through the use case registers it on Composio
beforeAll(async () => {
  process.env.COMPOSIO_WEBHOOK_SECRET = SECRET
  process.env.AUTOMATIONS_SECRET = RUN_SECRET
  persona = await createTestPersona("triggers")
  const link = await db.orm.public.Link.create({ channel: "telegram", line: "111", externalId: `triggers-${Date.now()}`, personaId: persona.personaId })
  linkId = link.id
  triggerId = `ti_test_${Date.now()}`
  await db.orm.public.Trigger.create({ id: triggerId, personaId: persona.personaId, name: "New email", prompt: "Sum up the new emails.", slug: SLUG, accountId: "ca_test" })
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

function routeOf(path: string) {
  const route = (triggers.routes as unknown as Route[]).find((candidate) => candidate.path === path)
  if (!route) throw new Error(`The triggers channel has no route ${path}.`)
  return route
}

// An event the way Composio posts it: a V3 envelope, signed over id.timestamp.body with the project's secret, through the channel's route. An event sent again keeps its id
async function post(metadata: Record<string, string>, data: Record<string, unknown>, secret = SECRET, id = `msg_${crypto.randomUUID()}`) {
  const body = JSON.stringify({ id, timestamp: new Date().toISOString(), type: "composio.trigger.message", metadata: { log_id: "log_test", trigger_slug: SLUG, trigger_id: triggerId, connected_account_id: "ca_test", auth_config_id: "ac_test", user_id: persona.personaId, ...metadata }, data })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest("base64")
  const request = new Request("https://persona.test/eve/v1/triggers", { method: "POST", headers: { "content-type": "application/json", "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` }, body })

  const response = await routeOf("/eve/v1/triggers").handler(request, { params: {} } as never)
  return response
}

// The run route the way the queue's consumer calls it, with a send that records what it got
async function startRun(runId: string, secret = RUN_SECRET) {
  const request = new Request(`https://persona.test/eve/v1/triggers/${triggerId}/${runId}`, { method: "POST", headers: { authorization: `Bearer ${secret}` } })
  const to = (_channel: unknown, target: unknown) => ({ send: async (message: unknown) => { if (failNextSend) { failNextSend = false; throw new Error("The send failed.") } sends.push({ target, message }); return { sessionId: `session_${sends.length}` } } })

  const response = await routeOf("/eve/v1/triggers/:triggerId/:runId").handler(request, { params: { triggerId, runId }, to } as never)
  return response
}

async function runsOfTrigger() {
  const runs = await db.orm.public.Run.where({ triggerId }).orderBy((run) => run.createdAt.asc()).all()
  return runs
}

async function waitingEvents() {
  const events = await db.orm.public.TriggerEvent.where({ triggerId }).where((event) => event.runId.isNull()).all()
  return events
}

test("a trigger's events wait in the db, with no run", async () => {
  const first = await post({}, { subject: "Invoice", sender: "a@example.com" }, SECRET, FIRST_EVENT)
  const second = await post({}, { subject: "Lunch", sender: "b@example.com" })
  assert.equal(first.status, 202)
  assert.equal(second.status, 202)
  assert.equal((await runsOfTrigger()).length, 0)
  assert.equal((await waitingEvents()).length, 2)
})

test("start claims nothing inside the five minutes, then one run with all the waiting events, even when two ticks race", async () => {
  await claimTriggerRuns(new Date(), 100)
  assert.equal((await runsOfTrigger()).length, 0)

  const later = new Date(Date.now() + AFTER_WINDOW_MS)
  await Promise.all([claimTriggerRuns(later, 100), claimTriggerRuns(later, 100)])

  const [run, ...more] = await runsOfTrigger()
  assert.equal(more.length, 0)
  assert.equal(run?.source, "trigger")
  assert.equal(run?.eventId, FIRST_EVENT)
  assert.equal(run?.sessionId, null)
  assert.equal((await waitingEvents()).length, 0)
  assert.equal((await db.orm.public.TriggerEvent.where({ runId: run!.id }).all()).length, 2)
})

test("the run route starts one session with all the events attached as JSON", async () => {
  const [run] = await runsOfTrigger()
  const response = await startRun(run!.id)
  assert.equal(response.status, 202)

  const [text, ...files] = sends[0].message as [{ text: string }, ...{ mediaType: string; filename: string; data: Uint8Array }[]]
  assert.match(text.text, /Your trigger "New email" just fired: GMAIL_NEW_GMAIL_MESSAGE/)
  assert.match(text.text, /2 in all/)
  assert.match(text.text, /Sum up the new emails\./)
  assert.deepEqual(files.map((file) => file.filename), ["trigger-event-1.json", "trigger-event-2.json"])
  assert.deepEqual(JSON.parse(new TextDecoder().decode(files[0].data)), { subject: "Invoice", sender: "a@example.com" })

  const [started] = await runsOfTrigger()
  assert.equal(started?.sessionId, "session_1")

  const again = await startRun(run!.id)
  assert.equal(again.status, 200)
  assert.equal(sends.length, 1)
})

test("an event Composio sends again is kept once and waits for nothing", async () => {
  const response = await post({}, { subject: "Invoice", sender: "a@example.com" }, SECRET, FIRST_EVENT)
  assert.equal(response.status, 202)
  assert.equal((await db.orm.public.TriggerEvent.where({ id: FIRST_EVENT }).all()).length, 1)
  assert.equal((await waitingEvents()).length, 0)
})

test("the run route refuses a call without the secret and drops a run that doesn't exist", async () => {
  const [run] = await runsOfTrigger()
  const refused = await startRun(run!.id, "wrong-secret")
  const missing = await startRun("no-such-run")
  assert.equal(refused.status, 401)
  assert.equal(missing.status, 404)
})

test("a trigger run's report route tells its chat in the trigger's words", async () => {
  const [run] = await runsOfTrigger()
  await completeRun(run!.id, "session_1", { summary: "Two new emails: an invoice and a lunch invite.", notify: true })

  // The report route the way the queue's consumer calls it, with a send that records what it got
  const told: unknown[] = []
  const to = () => ({ send: async (message: unknown) => { told.push(message); return { sessionId: "session_chat" } } })
  const request = new Request(`https://persona.test/eve/v1/triggers/${triggerId}/${run!.id}/report`, { method: "POST", headers: { authorization: `Bearer ${RUN_SECRET}` } })
  const response = await routeOf("/eve/v1/triggers/:triggerId/:runId/report").handler(request, { params: { triggerId, runId: run!.id }, to } as never)
  assert.equal(response.status, 202)
  assert.match(String(told[0]), /Your trigger "New email" just fired/)
  assert.match(String(told[0]), /an invoice and a lunch invite\./)
})

test("a chat with reports off hears nothing of a trigger run", async () => {
  const [run] = await runsOfTrigger()
  const told: unknown[] = []
  const to = () => ({ send: async (message: unknown) => { told.push(message); return { sessionId: "session_chat" } } })
  const request = new Request(`https://persona.test/eve/v1/triggers/${triggerId}/${run!.id}/report`, { method: "POST", headers: { authorization: `Bearer ${RUN_SECRET}` } })

  await db.orm.public.Link.where({ id: linkId }).update({ reports: false })
  const response = await routeOf("/eve/v1/triggers/:triggerId/:runId/report").handler(request, { params: { triggerId, runId: run!.id }, to } as never)
  await db.orm.public.Link.where({ id: linkId }).update({ reports: true })
  assert.equal(response.status, 202)
  assert.equal(told.length, 0)
})

test("an event signed with another secret is refused", async () => {
  const response = await post({}, { subject: "x" }, "wrong-secret")
  assert.equal(response.status, 401)
  assert.equal((await waitingEvents()).length, 0)
})

test("events of triggers we don't hold, or of another persona, are not kept", async () => {
  const unknown = await post({ trigger_id: "ti_unknown" }, { subject: "x" })
  const other = await post({ user_id: "someone-else" }, { subject: "x" })
  assert.equal(unknown.status, 200)
  assert.equal(other.status, 200)
  assert.equal((await waitingEvents()).length, 0)
})

test("a run whose send failed is started again when the queue hands it over again", async () => {
  await post({}, { subject: "Retro" })
  await claimTriggerRuns(new Date(Date.now() + AFTER_WINDOW_MS), 100)
  const run = (await runsOfTrigger()).at(-1)!

  failNextSend = true
  await assert.rejects(startRun(run.id))
  const [failed] = await db.orm.public.Run.where({ id: run.id }).all()
  assert.equal(failed?.sessionId, null)

  const response = await startRun(run.id)
  assert.equal(response.status, 202)
  const [started] = await db.orm.public.Run.where({ id: run.id }).all()
  assert.equal(started?.sessionId, `session_${sends.length}`)
})
