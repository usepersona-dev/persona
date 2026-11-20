import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import automations from "@/agent/channels/automations"
import { start } from "@/agent/schedules/start"
import { type AutomationRun, queue, type Report } from "@/lib/queue"
import { db } from "@/prisma/db"
import { createAutomation } from "@/usecases/automations"
import { completeRun, failRun } from "@/usecases/runs"
import { createTestPersona } from "@/tests/helpers"

type Route = { method: string; path: string; handler: (request: Request, args: never) => Promise<Response> }

let persona: Awaited<ReturnType<typeof createTestPersona>>
let linkId: string
let chat: string

// Stands in for the queue and the run route: the queue notes each run with its delay and hands it over at once, and the run route gives the run a session unless it has one. A report only has its route noted
const calls: (AutomationRun & { delaySeconds: number })[] = []
const reports: string[] = []
queue.sendBatch = (async (_topic: string, messages: { payload: AutomationRun; delaySeconds?: number }[]) => {
  const results = []
  for (const message of messages) {
    calls.push({ ...message.payload, delaySeconds: message.delaySeconds ?? 0 })
    await db.orm.public.Run.where({ id: message.payload.runId, sessionId: null }).updateAll({ sessionId: `session-call-${calls.length}` })
    results.push({ status: "sent", messageId: "test-message" })
  }
  return results
}) as unknown as typeof queue.sendBatch

queue.send = (async (_topic: string, payload: Report) => {
  reports.push(payload.path)
  return { messageId: "test-report" }
}) as unknown as typeof queue.send

beforeAll(async () => {
  persona = await createTestPersona("runner")
  const link = await db.orm.public.Link.create({ channel: "telegram", line: "111", externalId: `runner-${Date.now()}`, personaId: persona.personaId })
  linkId = link.id
  chat = `telegram:${link.line}:${link.externalId}:${persona.personaId}:${link.id}`
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

async function automation(input: Parameters<typeof createAutomation>[2]) {
  const created = await createAutomation(persona.caller, persona.personaId, input)
  if (!created.ok) throw new Error(created.error.message)
  return created.value
}

async function runsOf(automationId: string) {
  const runs = await db.orm.public.Run.where({ scheduleId: automationId }).all()
  return runs
}

// The report route the way the queue's consumer calls it, with a send that records what it got
async function reportRun(automationId: string, runId: string) {
  process.env.AUTOMATIONS_SECRET ??= "test-automations-secret"
  const route = (automations.routes as unknown as Route[]).find((candidate) => candidate.path === "/eve/v1/automations/:automationId/:runId/report")!
  const sent: { threadId: string; message: unknown; idempotencyKey?: string }[] = []
  const to = (_channel: unknown, target: { threadId: string }) => ({ send: async (message: unknown, options: { idempotencyKey?: string }) => { sent.push({ threadId: target.threadId, message, idempotencyKey: options.idempotencyKey }); return { sessionId: "session-chat" } } })

  const request = new Request(`https://persona.test/eve/v1/automations/${automationId}/${runId}/report`, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  const response = await route.handler(request, { params: { automationId, runId }, to } as never)
  return { status: response.status, sent }
}

test("a due automation gets one run, queued once even when two ticks race, and gets no new run while it's going", async () => {
  const minutely = await automation({ name: "Every minute", prompt: "Say hi.", cron: "* * * * *" })

  // Both ticks claim it on time, ten minutes ahead, as the real tick does; a claim after the due time could start it over five minutes back, where the same tick would take it for lost
  const claim = new Date(Date.parse(minutely.nextRunAt!) - 10 * 60_000)
  await Promise.all([start(claim), start(claim)])
  const runs = await runsOf(minutely.id)
  assert.equal(runs.length, 1)
  assert.equal(runs[0]?.status, "running")
  assert.ok(runs[0]?.sessionId)

  const called = calls.filter((item) => item.automationId === minutely.id)
  assert.equal(called.length, 1)

  await start(new Date(claim.getTime() + 60_000))
  const later = await runsOf(minutely.id)
  assert.equal(later.length, 1)
})

test("the next time follows the automation's own timezone and calendar", async () => {
  const morning = await automation({ name: "Morning", prompt: "Good morning.", cron: "30 9 * * *", timezone: "Asia/Jerusalem" })
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(new Date(morning.nextRunAt!))
  assert.equal(local, "09:30")

  const monthEnd = await automation({ name: "Month end", prompt: "Wrap up the month.", cron: "0 9 L * *" })
  const dayAfter = new Date(Date.parse(monthEnd.nextRunAt!) + 24 * 60 * 60_000)
  assert.equal(dayAfter.getUTCDate(), 1)
})

test("a one-time automation runs once, even when its time was missed", async () => {
  const at = new Date(Date.now() + 2_000)
  const reminder = await automation({ name: "Reminder", prompt: "Remind me.", at: at.toISOString() })

  await start(new Date(at.getTime() + 10 * 60_000))
  await db.orm.public.Run.where({ scheduleId: reminder.id }).updateAll({ status: "completed" })
  await start(new Date(at.getTime() + 11 * 60_000))
  const runs = await runsOf(reminder.id)
  assert.equal(runs.length, 1)

  const row = await db.orm.public.Schedule.where({ id: reminder.id }).first()
  assert.equal(row?.nextRunAt, null)
})

test("a repeating automation is claimed ten minutes ahead, once, to start up to ten minutes early, and that time doesn't come back", async () => {
  const minutely = await automation({ name: "Early", prompt: "Say hi early.", cron: "* * * * *" })
  const due = Date.parse(minutely.nextRunAt!)

  await start(new Date(due - 10 * 60_000 - 1))
  assert.equal((await runsOf(minutely.id)).length, 0)

  await start(new Date(due - 10 * 60_000))
  const [run, ...more] = await runsOf(minutely.id)
  assert.equal(more.length, 0)
  assert.equal(Date.parse(run!.scheduledFor!), due)
  const early = due - Date.parse(run!.claimedAt)
  assert.ok(early >= 0 && early < 10 * 60_000)

  const row = await db.orm.public.Schedule.where({ id: minutely.id }).first()
  assert.equal(Date.parse(row!.nextRunAt!), due + 60_000)
})

test("a one-time automation is claimed ahead but starts on its time, and the queue holds it until then", async () => {
  const at = new Date(Date.now() + 2 * 60_000)
  const onTime = await automation({ name: "On time", prompt: "Be on time.", at: at.toISOString() })

  await start(new Date())
  const [run] = await runsOf(onTime.id)
  assert.equal(Date.parse(run!.claimedAt), at.getTime())

  const [queued] = calls.filter((item) => item.runId === run!.id)
  assert.ok(queued!.delaySeconds > 110 && queued!.delaySeconds <= 120)
})

test("the run route starts the run's session at once and notes it, leaves alone a run that has one, and answers 404 for a run that's gone", async () => {
  process.env.AUTOMATIONS_SECRET ??= "test-automations-secret"
  const at = new Date(Date.now() + 2_000)
  const starting = await automation({ name: "Starting", prompt: "Start now.", at: at.toISOString() })
  const run = await db.orm.public.Run.create({ personaId: persona.personaId, source: "automation", title: starting.name, scheduleId: starting.id, scheduledFor: starting.nextRunAt!, claimedAt: starting.nextRunAt! })

  const route = (automations.routes as unknown as Route[]).find((candidate) => candidate.path === "/eve/v1/automations/:automationId/:runId")!
  let sends = 0
  const to = () => ({ send: async () => { sends++; return { sessionId: "session-now" } } })
  const call = async (runId: string) => {
    const request = new Request(`https://persona.test/eve/v1/automations/${starting.id}/${runId}`, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
    const response = await route.handler(request, { params: { automationId: starting.id, runId }, to } as never)
    return response
  }

  const first = await call(run.id)
  assert.equal(first.status, 202)
  const [started] = await runsOf(starting.id)
  assert.equal(started?.sessionId, "session-now")

  const again = await call(run.id)
  assert.equal(again.status, 200)
  assert.equal(sends, 1)

  const gone = await call("no-such-run")
  assert.equal(gone.status, 404)
})

test("a run waiting for its start isn't taken for lost, and once its start is five minutes past without a session it's sent again, once even when two ticks race", async () => {
  const at = new Date(Date.now() + 3 * 60_000)
  const waiting = await automation({ name: "Waiting", prompt: "Wait for me.", at: at.toISOString() })

  // Claimed ahead, and the queue never handed it over, so the run never got a session
  await start(new Date())
  const [run] = await runsOf(waiting.id)
  await db.orm.public.Run.where({ id: run!.id }).updateAll({ sessionId: null })

  calls.length = 0
  await start(new Date(at.getTime() + 4 * 60_000))
  assert.equal(calls.filter((item) => item.runId === run!.id).length, 0)

  const late = new Date(at.getTime() + 5 * 60_000 + 1_000)
  await Promise.all([start(late), start(late)])
  assert.equal(calls.filter((item) => item.runId === run!.id).length, 1)
  assert.equal((await runsOf(waiting.id)).length, 1)
})

test("a repeating automation whose times were missed runs once, at once, and its next time comes after now", async () => {
  const hourly = await automation({ name: "Missed", prompt: "Catch up.", cron: "0 * * * *" })

  // The ticks were down for three hours
  const missed = new Date(Date.parse(hourly.nextRunAt!) - 3 * 60 * 60_000).toISOString()
  await db.orm.public.Schedule.where({ id: hourly.id }).updateAll({ nextRunAt: missed })
  const now = new Date()
  await start(now)

  const [run, ...more] = await runsOf(hourly.id)
  assert.equal(more.length, 0)
  assert.equal(Date.parse(run!.scheduledFor!), Date.parse(missed))
  assert.ok(Date.parse(run!.claimedAt) <= now.getTime())

  const row = await db.orm.public.Schedule.where({ id: hourly.id }).first()
  assert.ok(Date.parse(row!.nextRunAt!) > now.getTime())
})

test("an every-minute automation claimed ahead runs every minute once, in order, with none skipped", async () => {
  const minutely = await automation({ name: "Each minute", prompt: "Tick.", cron: "* * * * *" })
  const first = Date.parse(minutely.nextRunAt!)

  // Five ticks a minute apart, each looking ten minutes ahead; each run ends before the next tick
  for (let minute = 0; minute < 5; minute++) {
    await start(new Date(first - 10 * 60_000 + minute * 60_000))
    await db.orm.public.Run.where({ scheduleId: minutely.id, status: "running" }).updateAll({ status: "completed" })
  }

  const runs = await runsOf(minutely.id)
  const dueTimes = runs.map((run) => Date.parse(run.scheduledFor!)).sort((a, b) => a - b)
  assert.deepEqual(dueTimes, [0, 1, 2, 3, 4].map((minute) => first + minute * 60_000))
})

test("a run that never got a session goes out again once its claim is five minutes old, once even when two ticks race, with no second run", async () => {
  const at = new Date(Date.now() + 2_000)
  const lost = await automation({ name: "Lost", prompt: "Find me.", at: at.toISOString() })
  await start(new Date(at.getTime() + 60_000))
  const [run] = await runsOf(lost.id)
  assert.ok(run?.sessionId)

  // The tick died before the run reached the queue, and that was six minutes ago
  const sixMinutesAgo = new Date(Date.now() - 6 * 60_000).toISOString()
  await db.orm.public.Run.where({ id: run!.id }).updateAll({ sessionId: null, claimedAt: sixMinutesAgo })

  calls.length = 0
  await Promise.all([start(new Date()), start(new Date())])
  const again = calls.filter((item) => item.automationId === lost.id)
  assert.equal(again.length, 1)

  const runs = await runsOf(lost.id)
  assert.equal(runs.length, 1)
  assert.ok(runs[0]?.sessionId)
})

test("a run ends once with what its session came back with, and an answer off the schema ends it as failed", async () => {
  const at = new Date(Date.now() + 2_000)
  const fact = await automation({ name: "Fact", prompt: "Share a fact.", at: at.toISOString() })
  const odd = await automation({ name: "Odd", prompt: "Answer oddly.", at: at.toISOString() })
  await start(new Date(at.getTime() + 60_000))
  const [factRun] = await runsOf(fact.id)
  const [oddRun] = await runsOf(odd.id)

  const first = await completeRun(factRun!.id, "session-fact", { summary: "Octopuses have three hearts.", notify: true })
  const second = await failRun(factRun!.id, "session-fact", "Again.")
  assert.equal(first.length, 1)
  assert.equal(second.length, 0)

  const [ended] = await runsOf(fact.id)
  assert.equal(ended?.status, "completed")
  assert.equal(ended?.sessionId, "session-fact")
  assert.deepEqual(ended?.result, { summary: "Octopuses have three hearts.", notify: true })

  await completeRun(oddRun!.id, "session-odd", { answer: 42 })
  const [failed] = await runsOf(odd.id)
  assert.equal(failed?.status, "failed")
  assert.equal(failed?.result?.notify, false)
})

test("the report route tells every chat of the persona that gets reports what came of the run, in the automation's words, keyed by the run and the chat, and answers 404 for a run that's gone", async () => {
  const at = new Date(Date.now() + 2_000)
  const fact = await automation({ name: "Fact to tell", prompt: "Share a fact.", at: at.toISOString() })
  await start(new Date(at.getTime() + 60_000))
  const [factRun] = await runsOf(fact.id)
  await completeRun(factRun!.id, "session-e", { summary: "Honey never spoils.", notify: true })

  const told = await reportRun(fact.id, factRun!.id)
  assert.equal(told.status, 202)
  assert.equal(told.sent.length, 1)
  assert.match(String(told.sent[0]?.message), /Your automation "Fact to tell" just ran on its own/)
  assert.match(String(told.sent[0]?.message), /Honey never spoils\./)
  assert.equal(told.sent[0]?.idempotencyKey, `report:${factRun!.id}:${linkId}`)
  assert.equal(told.sent[0]?.threadId, chat)

  await db.orm.public.Link.where({ id: linkId }).update({ reports: false })
  const off = await reportRun(fact.id, factRun!.id)
  await db.orm.public.Link.where({ id: linkId }).update({ reports: true })
  assert.equal(off.status, 202)
  assert.equal(off.sent.length, 0)

  const gone = await reportRun(fact.id, "no-such-run")
  assert.equal(gone.status, 404)
  assert.equal(gone.sent.length, 0)
})

test("a run going for over an hour is failed by the start tick, and its chat hears nothing", async () => {
  const at = new Date(Date.now() + 2_000)
  const slow = await automation({ name: "Slow", prompt: "Take forever.", at: at.toISOString(), linkId })
  await start(new Date(at.getTime() + 60_000))
  const [slowRun] = await runsOf(slow.id)

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
  await db.orm.public.Run.where({ id: slowRun!.id }).updateAll({ claimedAt: twoHoursAgo })
  reports.length = 0
  await start(new Date())

  const [stuck] = await runsOf(slow.id)
  assert.equal(stuck?.status, "failed")
  assert.equal(reports.length, 0)
})
