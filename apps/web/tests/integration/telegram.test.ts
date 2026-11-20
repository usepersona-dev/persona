import assert from "node:assert/strict"
import { afterAll, afterEach, beforeAll, test } from "vitest"

import { db } from "@/prisma/db"
import { createLinkCode } from "@/usecases/links"
import { writeSecret } from "@/usecases/secrets"
import { createTestPersona, settledCall } from "@/tests/helpers"

type Sent = { address: string; message: unknown; options: { auth: { attributes: Record<string, string> } } }
type Route = { method: string; handler: (request: Request, args: never) => Promise<Response> }
type Call = { token: string; method: string; body: Record<string, unknown> }

const BOT_A = String(7000000000 + Math.floor(Math.random() * 99999999))
const BOT_B = String(8000000000 + Math.floor(Math.random() * 99999999))
const TOKEN_A = `${BOT_A}:TEST_A`
const TOKEN_B = `${BOT_B}:TEST_B`
const FAN = 5550001111

const realFetch = globalThis.fetch
const calls: Call[] = []
const sends: Sent[] = []
let persona: Awaited<ReturnType<typeof createTestPersona>>
let telegram: typeof import("@/agent/channels/telegram")

beforeAll(async () => {
  process.env.TELEGRAM_WEBHOOK_SECRET ??= "test-secret"
  globalThis.fetch = fake as typeof fetch
  telegram = await import("@/agent/channels/telegram")
  persona = await createTestPersona("telegram")

  const project = await db.orm.public.Persona.where({ id: persona.personaId }).first()
  for (const [botId, token] of [[BOT_A, TOKEN_A], [BOT_B, TOKEN_B]]) {
    const bot = await db.orm.public.TelegramBot.create({ projectId: project?.projectId ?? "", botId, username: `bot${botId}`, name: "Test bot" })
    await writeSecret(bot.id, [{ name: "token", value: token }])
  }
})

afterEach(() => {
  calls.length = 0
  sends.length = 0
})

afterAll(async () => {
  await persona.cleanup()
  globalThis.fetch = realFetch
  await db.close()
})

async function fake(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init)
  const url = new URL(request.url)
  if (url.hostname !== "api.telegram.org") return realFetch(input, init)

  const [, path = "", method = ""] = url.pathname.split("/")
  const text = await request.text()
  const body = text.startsWith("{") ? (JSON.parse(text) as Record<string, unknown>) : {}
  calls.push({ token: path.replace(/^bot/, ""), method, body })

  if (method === "getMe") return Response.json({ ok: true, result: { id: Number(path.replace(/^bot/, "").split(":")[0]), is_bot: true, first_name: "Bot", username: "bot" } })
  if (method === "sendChatAction" || method.endsWith("Webhook")) return Response.json({ ok: true, result: true })
  return Response.json({ ok: true, result: { message_id: 900 + calls.length, date: 1759000000, chat: { id: Number(body.chat_id ?? FAN), type: "private" }, text: body.text } })
}

async function receive(botId: string, updateId: number, message: Record<string, unknown>) {
  const update = { update_id: updateId, message: { message_id: updateId, date: 1759000000, from: { id: FAN, is_bot: false, first_name: "Dana" }, chat: { id: FAN, type: "private", first_name: "Dana" }, ...message } }
  const request = new Request(`https://persona.test/eve/v1/telegram/${botId}`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET ?? "" }, body: JSON.stringify(update) })

  const route = (telegram.channel.routes as unknown as Route[]).find((candidate) => candidate.method === "POST")
  if (!route) throw new Error("The Telegram channel has no POST route.")

  const tasks: Promise<unknown>[] = []
  const from = (address: string) => ({ send: async (sent: unknown, options: Sent["options"]) => void sends.push({ address, message: sent, options }) })
  const response = await route.handler(request, { params: { botId }, from, waitUntil: (task: Promise<unknown>) => void tasks.push(task) } as never)
  for (let index = 0; index < tasks.length; index += 1) await tasks[index]
  return response
}

function lastText(token: string) {
  const sent = calls.filter((call) => call.method === "sendMessage" && call.token === token).at(-1)
  const text = String(sent?.body.text ?? "")
  return text
}

test("a stranger is asked to link, /start with a code links the chat, and then a message reaches that persona's own session", async () => {
  await receive(BOT_A, 1000, { text: "hi" })
  assert.match(lastText(TOKEN_A), /isn't connected to a persona yet/)

  const linkCode = await createLinkCode(persona.caller, persona.personaId)
  assert.ok(linkCode.ok)
  const command = `/start ${linkCode.value.code}`
  await receive(BOT_A, 1001, { text: command, entities: [{ type: "bot_command", offset: 0, length: 6 }] })
  assert.match(lastText(TOKEN_A), /You're connected to/)

  await receive(BOT_A, 1002, { text: "hello" })
  assert.equal(sends.length, 1)
  const link = await db.orm.public.Link.where({ channel: "telegram", line: BOT_A, externalId: String(FAN) }).first()
  assert.equal(sends[0]?.address, `telegram:${BOT_A}:${FAN}:${persona.personaId}:${link?.id}`)
  assert.match(String(sends[0]?.message), /^\[#\d+\] hello$/)
  assert.deepEqual(sends[0]?.options.auth.attributes, { orgId: persona.caller.orgId, userId: `telegram:${BOT_A}:${FAN}`, personaId: persona.personaId, linkId: link?.id, channel: "telegram" })
})

test("the same person on a second bot is a separate chat, even with the same update and message ids", async () => {
  await receive(BOT_B, 1002, { text: "hello" })

  assert.equal(sends.length, 0)
  assert.match(lastText(TOKEN_B), /isn't connected to a persona yet/)
  assert.ok(calls.every((call) => call.token !== TOKEN_A))
})

test("a reply after the webhook still goes out from the bot in its thread id", async () => {
  await telegram.telegram.postMessage(telegram.telegram.encodeThreadId({ botId: BOT_B, chatId: String(FAN) }), "from B")
  await telegram.telegram.postMessage(telegram.telegram.encodeThreadId({ botId: BOT_A, chatId: String(FAN), personaId: persona.personaId }), "from A")

  assert.equal(lastText(TOKEN_B), "from B")
  assert.equal(lastText(TOKEN_A), "from A")
})

test("a reply keeps its markdown as written and a file goes out as real media", async () => {
  const id = crypto.randomUUID()
  await db.orm.public.File.create({ id, personaId: persona.personaId, size: 10, name: "logo.png", contentType: "image/png" })
  const logo = `https://example.test/${persona.personaId}/${id}`

  const posted: unknown[] = []
  const thread = { post: async (message: unknown) => void posted.push(message) } as never
  await telegram.reply(thread, "## Your logo\n\nHere it is, more on [our site](https://usepersona.dev/about).")
  await telegram.sendFile(thread, { url: logo, name: "logo.png", contentType: "image/png" })

  assert.equal(posted.length, 2)
  assert.deepEqual(posted[0], { markdown: "## Your logo\n\nHere it is, more on [our site](https://usepersona.dev/about)." })

  const media = posted[1] as { raw: string; attachments: { fetchData?: unknown }[] }
  const { fetchData, ...attachment } = media.attachments[0] ?? {}
  assert.equal(typeof fetchData, "function")
  assert.deepEqual(attachment, { type: "image", url: logo, name: "logo.png", mimeType: "image/png" })
})

// A thread as eve hands it to the channel's events: it keeps what was posted and how often typing started
async function chatThread() {
  const link = await db.orm.public.Link.where({ channel: "telegram", line: BOT_A, externalId: String(FAN) }).first()
  const thread = { id: telegram.encodeThreadId(BOT_A, String(FAN), persona.personaId, link?.id ?? ""), posted: [] as unknown[], typing: 0, post: async (message: unknown) => void thread.posted.push(message), startTyping: async () => void (thread.typing += 1) }
  return thread
}

function toolCall(toolName: string, input: Record<string, unknown>) {
  const call = { kind: "tool-call", callId: crypto.randomUUID(), toolName, input }
  return call
}

// One call's result the way eve hands it to the channel once the tool has run; the chat tools pass their input through
function toolResult(toolName: string, output: unknown) {
  const result = settledCall(toolName, output)
  return result
}

test("each chat tool call goes out once it has run: a message, a quoted reply, and a reaction on the tagged or the latest message; a failed call and any other tool send nothing", async () => {
  await receive(BOT_A, 2001, { text: "first" })
  await receive(BOT_A, 2002, { text: "second" })
  calls.length = 0

  const thread = await chatThread()
  const requested = telegram.events["call.requested"]
  const handle = telegram.events["call.settled"]
  assert.ok(requested && handle)
  await requested({ type: "call.requested", data: { callId: crypto.randomUUID(), owner: { runId: "run_test" }, capability: { kind: "tool", name: "chat_say" } }, scope: { turnId: "turn_test" } } as never, { channel: { thread } } as never)
  const results = [toolResult("chat_say", { text: "Hello **there**" }), toolResult("chat_say", { text: "About that", replyTo: "2001" }), toolResult("chat_react", { emoji: "👍" }), toolResult("chat_react", { emoji: "🎉", to: "2001" }), toolResult("web_search", { text: "moon" }), settledCall("chat_say", "Invalid input", "failed")]
  for (const result of results) await handle(result.event as never, { channel: { thread }, view: result.view } as never)

  assert.deepEqual(thread.posted, [{ markdown: "Hello **there**" }])

  const quoted = calls.filter((call) => call.method === "sendMessage")
  assert.equal(quoted.length, 1)
  assert.match(String(quoted[0]?.body.text), /About that/)
  assert.equal((quoted[0]?.body.reply_parameters as { message_id?: number } | undefined)?.message_id, 2001)

  const reactions = calls.filter((call) => call.method === "setMessageReaction")
  assert.deepEqual(reactions.map((call) => call.body.message_id), [2002, 2001])
  assert.equal(thread.typing, 1, "typing starts once, when the step starts")
})

test("a file goes out once chat_file has run, by the public link it returned; a failed chat_file or another tool's result sends nothing", async () => {
  const thread = await chatThread()
  const fileId = crypto.randomUUID()
  await db.orm.public.File.create({ id: fileId, personaId: persona.personaId, size: 10, name: "brief.pdf", contentType: "application/pdf" })
  const brief = `https://example.test/${persona.personaId}/${fileId}`
  const handle = telegram.events["call.settled"]
  assert.ok(handle)

  const results = [
    settledCall("chat_file", { url: brief, name: "brief.pdf", contentType: "application/pdf", size: 10 }),
    settledCall("chat_file", "That file id is not real.", "failed"),
    settledCall("web_fetch", { url: brief }),
  ]
  for (const result of results) await handle(result.event as never, { channel: { thread }, view: result.view } as never)

  assert.equal(thread.posted.length, 1)
  assert.equal((thread.posted[0] as { attachments: { url?: string }[] }).attachments[0]?.url, brief)
})

test("typing shows when a turn starts and when each step starts", async () => {
  await receive(BOT_A, 2101, { text: "hi" })
  calls.length = 0

  const thread = await chatThread()
  const started = telegram.events["turn.started"]
  const requested = telegram.events["call.requested"]
  assert.ok(started && requested)
  const step = (actions: unknown[]) => requested({ type: "call.requested", data: { callId: crypto.randomUUID(), owner: { runId: "run_test" }, capability: { kind: "tool", name: "chat_say" }, input: actions }, scope: { turnId: "turn_typing" } } as never, { channel: { thread } } as never)

  await started({ type: "turn.started", data: { turnId: "turn_typing", cause: {}, follows: null } } as never, { channel: { thread } } as never)
  assert.equal(thread.typing, 1, "a turn that starts")
  await step([toolCall("chat_say", { text: "Checking." }), toolCall("web_search", { query: "moon" })])
  assert.equal(thread.typing, 2, "a step that starts")
  await step([toolCall("chat_say", { text: "Done." })])
  assert.equal(thread.typing, 3, "every step")
})

test("the persona's own text reaches no one, and a failed turn tells the person", async () => {
  const thread = await chatThread()
  const completed = telegram.events["content.completed"]
  assert.ok(completed, "the channel answers content.completed itself, or eve's default posts the text")
  await completed({ type: "content.completed", data: { partId: "part_test", runId: "run_test", kind: "text", phase: "reply", value: "Sent two facts." } } as never, { channel: { thread } } as never)
  assert.deepEqual(thread.posted, [])

  const failed = telegram.events["turn.settled"]
  assert.ok(failed)
  await failed({ type: "turn.settled", data: { turnId: "turn_test", outcome: "failed", error: { code: "TEST", message: "The model failed." } } } as never, { channel: { thread } } as never)
  assert.match(String((thread.posted[0] as { markdown?: string } | undefined)?.markdown), /Something went wrong on my side/)
})
