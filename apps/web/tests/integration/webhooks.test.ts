import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import webhooks from "@/agent/channels/webhooks"
import webhookCreate from "@/agent/tools/webhook_create"
import webhookDelete from "@/agent/tools/webhook_delete"
import webhookList from "@/agent/tools/webhook_list"
import webhookUpdate from "@/agent/tools/webhook_update"
import { db } from "@/prisma/db"
import { completeRun, failRun, failStuckRuns } from "@/usecases/runs"
import { createWebhook } from "@/usecases/webhooks"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

type Route = { method: string; path: string; handler: (request: Request, args: never) => Promise<Response> }

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never
let linkId: string

beforeAll(async () => {
  persona = await createTestPersona("webhooks")
  context = toolContext(persona.caller, persona.personaId)
  const link = await db.orm.public.Link.create({ channel: "telegram", line: "111", externalId: `webhooks-${Date.now()}`, personaId: persona.personaId })
  linkId = link.id
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

async function webhook(input: Parameters<typeof createWebhook>[2]) {
  const created = await createWebhook(persona.caller, persona.personaId, input)
  if (!created.ok) throw new Error(created.error.message)
  return created.value
}

// A run of the webhook, made the way the webhook route makes one
async function runOf(webhookId: string) {
  const webhook = await db.orm.public.Webhook.where({ id: webhookId }).first()
  const run = await db.orm.public.Run.create({ personaId: webhook!.personaId, source: "webhook", title: webhook!.name, linkId: webhook!.linkId, webhookId })
  return run
}

// The report route the way the queue's consumer calls it, with a send that records what it got
async function reportRun(webhookId: string, runId: string) {
  process.env.AUTOMATIONS_SECRET ??= "test-automations-secret"
  const route = (webhooks.routes as unknown as Route[]).find((candidate) => candidate.path === "/eve/v1/webhooks/:webhookId/:runId/report")!
  const sent: unknown[] = []
  const to = () => ({ send: async (message: unknown) => { sent.push(message); return { sessionId: "session-chat" } } })

  const request = new Request(`https://persona.test/eve/v1/webhooks/${webhookId}/${runId}/report`, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  const response = await route.handler(request, { params: { webhookId, runId }, to } as never)
  return { status: response.status, sent }
}

test("webhooks: create, list, update, delete", async () => {
  const created = await run(webhookCreate, { name: "New order", prompt: "Thank the buyer." }, context)
  assert.equal(created.enabled, true)
  assert.match(created.url, /\/eve\/v1\/webhooks\/[0-9a-f-]{36}$/)

  const listed = await run(webhookList, {}, context)
  assert.equal(listed.webhooks.length, 1)
  assert.equal(listed.webhooks[0]?.url, created.url)

  const paused = await run(webhookUpdate, { id: created.id, enabled: false }, context)
  assert.equal(paused.enabled, false)
  assert.equal(paused.url, created.url)

  await run(webhookDelete, { id: created.id }, context)
  const emptied = await run(webhookList, {}, context)
  assert.equal(emptied.webhooks.length, 0)
})

test("webhooks: an unknown webhook is refused", async () => {
  await assert.rejects(run(webhookUpdate, { id: "unknown", enabled: false }, context), /does not exist/)
  await assert.rejects(run(webhookDelete, { id: "unknown" }, context), /does not exist/)
})

test("a webhook run ends once, and its report route tells its chat in the webhook's words", async () => {
  const orders = await webhook({ name: "New order", prompt: "Thank the buyer.", linkId })
  const orderRun = await runOf(orders.id)

  const first = await completeRun(orderRun.id, "session-a", { summary: "Order 12 came in.", notify: true })
  const second = await failRun(orderRun.id, "session-a", "Again.")
  assert.equal(first.length, 1)
  assert.equal(second.length, 0)

  const ended = await db.orm.public.Run.where({ id: orderRun.id }).first()
  assert.equal(ended?.status, "completed")
  assert.equal(ended?.sessionId, "session-a")

  const told = await reportRun(orders.id, orderRun.id)
  assert.equal(told.status, 202)
  assert.match(String(told.sent[0]), /Your webhook "New order" was just called by another app/)
  assert.match(String(told.sent[0]), /Order 12 came in\./)
})

test("a webhook run going for over an hour is failed", async () => {
  const slow = await webhook({ name: "Slow", prompt: "Take forever.", linkId })
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
  const slowRun = await runOf(slow.id)
  await db.orm.public.Run.where({ id: slowRun.id }).updateAll({ claimedAt: twoHoursAgo })

  const failed = await failStuckRuns(new Date())
  const stuck = await db.orm.public.Run.where({ id: slowRun.id }).first()
  assert.equal(stuck?.status, "failed")
  assert.ok(failed.some((run) => run.id === slowRun.id))
})
