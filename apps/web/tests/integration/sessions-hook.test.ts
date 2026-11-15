import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import { emptySessionView, foldEvents } from "eve/events"

import hook from "@/agent/hooks/sessions"
import { db } from "@/prisma/db"
import { createTestPersona } from "@/tests/helpers"

type Handler = (event: never, ctx: never) => Promise<void>
type Fact = { type: string; data: Record<string, unknown>; scope: Record<string, string>; meta: { position: { line: number; index: number }; at: string; endOfLine: true } }

let persona: Awaited<ReturnType<typeof createTestPersona>>
let clock = Date.now()

beforeAll(async () => {
  persona = await createTestPersona("sessions-hook")
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

// A chat session of the test persona, as eve hands its facts to the hook: one fact per line, each a second after the last so the rows keep their order, with the session folded up to it
function chat() {
  const id = `wrun_test_${crypto.randomUUID()}`
  const facts: Fact[] = []
  const scope = { turnId: "turn_1", runId: "run_1" }

  async function handle(fact: Fact) {
    const view = foldEvents(emptySessionView(), facts as never)
    const attributes = { orgId: persona.caller.orgId, userId: persona.caller.userId, personaId: persona.personaId, channel: "telegram" }
    const ctx = { session: { id, auth: { initiator: { attributes } } }, channel: { continuationToken: `telegram:test:${id}` }, view, position: fact.meta.position, now: new Date(fact.meta.at) }

    const handler = (hook.events as Record<string, Handler | undefined>)[fact.type]
    if (handler) await handler(fact as never, ctx as never)
  }

  async function emit(type: string, data: Record<string, unknown>) {
    clock += 1000
    const fact: Fact = { type, data, scope, meta: { position: { line: facts.length + 1, index: 0 }, at: new Date(clock).toISOString(), endOfLine: true } }
    facts.push(fact)
    await handle(fact)
    return `${id}:${fact.meta.position.line}:0`
  }

  // One tool call, asked for and then settled; the chat tools pass their input through
  async function settle(name: string, output: unknown, outcome = "completed") {
    const callId = crypto.randomUUID()
    await emit("call.requested", { callId, owner: { runId: scope.runId }, capability: { kind: "tool", name } })
    const row = await emit("call.settled", { callId, outcome, output })
    return row
  }

  // eve hands the last fact over again, as after a retried step
  async function replay() {
    const last = facts.at(-1)
    if (last) await handle(last)
  }

  return { id, emit, settle, replay }
}

// A session's rows in the order they happened
async function rowsOf(sessionId: string) {
  const messages = await db.orm.public.Message.where({ sessionId }).all()
  const sorted = messages.toSorted((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id))
  const rows = sorted.map((message) => ({ id: message.id, role: message.role, tool: message.tool, text: message.text, files: message.files }))
  return rows
}

test("a turn keeps what the person sent without its tag, each message and file the persona sent with the tool that sent it, and its closing line with no tool", async () => {
  const session = chat()
  const fileId = crypto.randomUUID()
  await db.orm.public.File.create({ id: fileId, personaId: persona.personaId, size: 42, name: "plan.md", contentType: "text/markdown" })
  const url = `https://example.test/${persona.personaId}/${fileId}`

  await session.emit("turn.started", { turnId: "turn_1", cause: { kind: "delivery" }, follows: null })
  const received = await session.emit("delivery.consumed", { deliveryId: "delivery_1", turnId: "turn_1", parts: [{ kind: "text", text: "[#a1b2c3] send me the plan" }] })
  const said = await session.settle("chat_say", { text: "Here it is", replyTo: "a1b2c3" })
  const sent = await session.settle("chat_file", { url, name: "plan.md", contentType: "text/markdown", size: 42 })
  await session.settle("chat_react", { emoji: "👍" })
  await session.settle("web_search", { text: "plan" })
  await session.settle("chat_say", "Invalid input", "failed")
  await session.settle("chat_file", "That file id is not real.", "failed")
  const closing = await session.emit("content.completed", { partId: "part_1", runId: "run_1", kind: "text", phase: "reply", value: "Sent the plan." })
  await session.emit("content.completed", { partId: "part_2", runId: "run_1", kind: "text", phase: "reply", value: "  " })

  assert.deepEqual(await rowsOf(session.id), [
    { id: received, role: "user", tool: null, text: "send me the plan", files: null },
    { id: said, role: "assistant", tool: "chat_say", text: "Here it is", files: null },
    { id: sent, role: "assistant", tool: "chat_file", text: "", files: [{ name: "plan.md", type: "text/markdown", size: 42, url }] },
    { id: closing, role: "assistant", tool: null, text: "Sent the plan.", files: null },
  ])
})

test("a fact handed over twice keeps one row, and a later call is a row of its own", async () => {
  const session = chat()
  await session.emit("turn.started", { turnId: "turn_1", cause: { kind: "delivery" }, follows: null })

  const once = await session.settle("chat_say", { text: "Once" })
  await session.replay()
  const again = await session.settle("chat_say", { text: "Again" })

  const rows = await rowsOf(session.id)
  assert.deepEqual(rows.map((row) => [row.id, row.text]), [[once, "Once"], [again, "Again"]])
})

test("a failed turn and a cleared chat each leave a note, and a failed session ends failed", async () => {
  const session = chat()
  await session.emit("turn.started", { turnId: "turn_1", cause: { kind: "delivery" }, follows: null })
  await session.emit("turn.settled", { turnId: "turn_1", outcome: "failed", error: { code: "MODEL_FAILED", message: "The model failed." } })
  await session.emit("context.settled", { changeId: "change_1", kind: "clear", outcome: "completed", selects: null })
  await session.emit("session.ended", { outcome: "failed", error: { code: "MODEL_FAILED", message: "The model failed." } })

  const rows = await rowsOf(session.id)
  assert.deepEqual(rows.map((row) => [row.role, row.text]), [["system", "Failed: The model failed."], ["system", "Chat cleared"]])

  const ended = await db.orm.public.Session.where({ id: session.id }).first()
  assert.equal(ended?.status, "failed")
})
