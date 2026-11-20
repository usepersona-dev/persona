import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { afterAll, afterEach, beforeAll, test } from "vitest"

import { db } from "@/prisma/db"
import { createLinkCode } from "@/usecases/links"
import { createTestPersona, settledCall } from "@/tests/helpers"

type Sent = { address: string; message: unknown; options: { auth: { attributes: Record<string, string> } } }
type Route = { method: string; handler: (request: Request, args: never) => Promise<Response> }
type Call = { url: URL; method: string; body: string }

const LINE = String(200000 + Math.floor(Math.random() * 799999))
const FAN = "15550001111"

const realFetch = globalThis.fetch
const calls: Call[] = []
const sends: Sent[] = []
let persona: Awaited<ReturnType<typeof createTestPersona>>
let whatsapp: typeof import("@/agent/channels/whatsapp")

beforeAll(async () => {
  globalThis.fetch = fake as typeof fetch
  process.env.KAPSO_PHONE_NUMBER_ID = LINE
  whatsapp = await import("@/agent/channels/whatsapp")
  persona = await createTestPersona("whatsapp")
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
  if (url.hostname !== "api.kapso.ai" && url.hostname !== "media.test") return realFetch(input, init)

  const body = await request.text()
  calls.push({ url, method: request.method, body })
  if (url.hostname === "media.test") return new Response("OGGBYTES", { headers: { "content-type": "audio/ogg" } })
  if (url.pathname.endsWith("/webhooks")) return Response.json({ data: [] })
  if (url.pathname.endsWith("/media-1")) return Response.json({ id: "media-1", url: "https://media.test/voice.ogg", mime_type: "audio/ogg" })
  return Response.json({ messaging_product: "whatsapp", contacts: [], messages: [{ id: "wamid.out" }] })
}

async function receive(message: Record<string, unknown>) {
  const event = { phone_number_id: LINE, conversation: { id: "conv_1", phone_number: FAN, contact_name: "Dana", phone_number_id: LINE }, message: { id: `wamid.${crypto.randomUUID()}`, from: FAN, timestamp: "1759000000", kapso: { direction: "inbound" }, ...message }, is_new_conversation: false }
  const body = JSON.stringify(event)
  const signature = createHmac("sha256", process.env.KAPSO_WEBHOOK_SECRET ?? "").update(body).digest("hex")
  const request = new Request(`https://persona.test/eve/v1/whatsapp/${LINE}`, { method: "POST", headers: { "content-type": "application/json", "x-webhook-signature": signature, "x-webhook-event": "whatsapp.message.received", "x-idempotency-key": crypto.randomUUID() }, body })

  const route = (whatsapp.channel.routes as unknown as Route[]).find((candidate) => candidate.method === "POST")
  if (!route) throw new Error("The WhatsApp channel has no POST route.")

  const tasks: Promise<unknown>[] = []
  const from = (address: string) => ({ send: async (sent: unknown, options: Sent["options"]) => void sends.push({ address, message: sent, options }) })
  const response = await route.handler(request, { params: { phoneNumberId: LINE }, from, waitUntil: (task: Promise<unknown>) => void tasks.push(task) } as never)
  for (let index = 0; index < tasks.length; index += 1) await tasks[index]
  return response
}

function sentTexts() {
  const bodies = calls.filter((call) => call.method === "POST" && call.url.pathname.endsWith("/messages")).map((call) => JSON.parse(call.body) as { text?: { body?: string } })
  const texts = bodies.map((body) => body.text?.body ?? "").join("\n")
  return texts
}

function kapsoThread(...parts: string[]) {
  const threadId = ["kapso", ...parts.map((part) => Buffer.from(part).toString("base64url"))].join(":")
  return threadId
}

test("a stranger is asked for a link code, the code links the chat, and then a message reaches that persona's own session", async () => {
  await receive({ type: "text", text: { body: "hi" } })
  assert.match(sentTexts(), /isn't connected to a persona yet/)
  assert.ok(calls.some((call) => call.body.includes("typing_indicator")))

  const linkCode = await createLinkCode(persona.caller, persona.personaId)
  assert.ok(linkCode.ok)
  await receive({ type: "text", text: { body: `link ${linkCode.value.code}` } })
  assert.match(sentTexts(), /You're connected to/)

  await receive({ type: "text", text: { body: "hello" } })
  assert.equal(sends.length, 1)
  const link = await db.orm.public.Link.where({ channel: "whatsapp", line: LINE, externalId: FAN }).first()
  assert.equal(sends[0]?.address, kapsoThread(LINE, FAN, `${persona.personaId}:${link?.id}`))
  assert.match(String(sends[0]?.message), /^\[#[0-9a-f]{6}\] hello$/)
  assert.deepEqual(sends[0]?.options.auth.attributes, { orgId: persona.caller.orgId, userId: `whatsapp:${LINE}:${FAN}`, personaId: persona.personaId, linkId: link?.id, channel: "whatsapp" })
})

test("a chat linked again on a new link is a new chat, with the new link's id", async () => {
  await receive({ type: "text", text: { body: "first" } })
  const before = await db.orm.public.Link.where({ channel: "whatsapp", line: LINE, externalId: FAN }).first()
  assert.ok(before)

  // The link row goes, as when the persona it sat on is deleted, and the person links again
  await db.orm.public.Link.where({ id: before.id }).delete()
  const linkCode = await createLinkCode(persona.caller, persona.personaId)
  assert.ok(linkCode.ok)
  await receive({ type: "text", text: { body: `link ${linkCode.value.code}` } })
  await receive({ type: "text", text: { body: "second" } })
  const after = await db.orm.public.Link.where({ channel: "whatsapp", line: LINE, externalId: FAN }).first()
  assert.ok(after)
  assert.notEqual(after.id, before.id)

  assert.equal(sends.length, 2)
  assert.equal(sends[0]?.address, kapsoThread(LINE, FAN, `${persona.personaId}:${before.id}`))
  assert.equal(sends[1]?.address, kapsoThread(LINE, FAN, `${persona.personaId}:${after.id}`))
  assert.equal(sends[1]?.options.auth.attributes.linkId, after.id)
})

test("a voice note keeps its file and uses Kapso's transcript", async () => {
  await receive({ type: "audio", audio: { id: "media-1", mime_type: "audio/ogg; codecs=opus", voice: true }, kapso: { direction: "inbound", transcript: { text: "hello from my voice" }, media_data: { content_type: "audio/ogg; codecs=opus" } } })

  assert.ok(calls.some((call) => call.url.pathname.endsWith("/media-1")))
  assert.match(String(sends[0]?.message), /^\[#[0-9a-f]{6}\] \[Voice note, file id [0-9a-f-]{36}\] hello from my voice$/)
})

test("a reply reads as WhatsApp: links stay where they are, a bare address stays plain, a heading turns bold and a table turns monospace", () => {
  const text = whatsapp.render("# Your week\n\nMore on [our site](https://usepersona.dev/about) or https://example.com/docs, or write to info@usepersona.dev or [the shop](tel:+15551234567).\n\n| Day | Plan |\n| --- | --- |\n| Mon | Gym |")

  assert.match(text, /^\*Your week\*/)
  assert.match(text, /More on our site \(https:\/\/usepersona\.dev\/about\) or https:\/\/example\.com\/docs, or write to info@usepersona\.dev or \+15551234567\./)
  assert.match(text, /```[\s\S]*Day[\s\S]*Mon[\s\S]*```/)
})

test("a reply goes out as plain WhatsApp text, with its link's preview on", async () => {
  await whatsapp.reply({ id: kapsoThread(LINE, FAN, persona.personaId) } as never, "Here **you** go: https://usepersona.dev")

  const sent = calls.filter((call) => call.method === "POST" && call.url.pathname.endsWith("/messages")).map((call) => JSON.parse(call.body) as { to?: string; text?: { body?: string; preview_url?: boolean } })
  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.to, FAN)
  assert.deepEqual(sent[0]?.text, { body: "Here *you* go: https://usepersona.dev", preview_url: true })
})

test("a file goes out as real media with its own name and type", async () => {
  const kinds = [
    { name: "logo.png", contentType: "image/png" },
    { name: "hello.mp3", contentType: "audio/mpeg" },
    { name: "brief.pdf", contentType: "application/pdf" },
  ]
  const [logo, voice, brief] = kinds.map(() => `https://example.test/${persona.personaId}/${crypto.randomUUID()}`)

  const posted: unknown[] = []
  const thread = { post: async (message: unknown) => void posted.push(message) } as never
  for (const [index, url] of [logo, voice, brief].entries()) await whatsapp.sendFile(thread, { url: url!, ...kinds[index]! })

  assert.deepEqual(posted, [
    { raw: "", attachments: [{ type: "image", url: logo, name: "logo.png", mimeType: "image/png" }] },
    { raw: "", attachments: [{ type: "audio", url: voice, name: "hello.mp3", mimeType: "audio/mpeg" }] },
    { raw: "", attachments: [{ type: "file", url: brief, name: "brief.pdf", mimeType: "application/pdf" }] },
  ])
})

// A thread as eve hands it to the channel's events: it keeps what was posted. Typing goes to Kapso, not through the thread
async function chatThread() {
  const link = await db.orm.public.Link.where({ channel: "whatsapp", line: LINE, externalId: FAN }).first()
  const thread = { id: kapsoThread(LINE, FAN, `${persona.personaId}:${link?.id}`), posted: [] as unknown[], post: async (message: unknown) => void thread.posted.push(message) }
  return thread
}

// One call's result the way eve hands it to the channel once the tool has run; the chat tools pass their input through
function toolResult(toolName: string, output: unknown) {
  const result = settledCall(toolName, output)
  return result
}

test("each chat tool call goes out once it has run: a message, a quoted reply, and a reaction on the tagged or the latest message; a failed call and any other tool send nothing", async () => {
  const first = `wamid.first-${crypto.randomUUID()}`
  const second = `wamid.second-${crypto.randomUUID()}`
  await receive({ id: first, type: "text", text: { body: "first" } })
  await receive({ id: second, type: "text", text: { body: "second" } })
  const tag = /^\[#([0-9a-f]{6})\]/.exec(String(sends[0]?.message))?.[1] ?? ""
  calls.length = 0

  const thread = await chatThread()
  const requested = whatsapp.events["call.requested"]
  const handle = whatsapp.events["call.settled"]
  assert.ok(requested && handle)
  await requested({ type: "call.requested", data: { callId: crypto.randomUUID(), owner: { runId: "run_test" }, capability: { kind: "tool", name: "chat_say" } }, scope: { turnId: "turn_test" } } as never, { channel: { thread } } as never)
  const results = [toolResult("chat_say", { text: "Hello **there**" }), toolResult("chat_say", { text: "About that", replyTo: tag }), toolResult("chat_react", { emoji: "👍" }), toolResult("chat_react", { emoji: "🎉", to: tag }), toolResult("web_search", { text: "moon" }), settledCall("chat_say", "Invalid input", "failed")]
  for (const result of results) await handle(result.event as never, { channel: { thread }, view: result.view } as never)

  assert.deepEqual(thread.posted, [])
  const posts = calls.filter((call) => call.method === "POST" && call.url.pathname.endsWith("/messages")).map((call) => call.body)
  const bodies = posts.filter((body) => !body.includes("typing_indicator"))
  assert.equal(bodies.length, 4)
  assert.ok(bodies[0]?.includes("Hello *there*") && !bodies[0].includes("context"), "a message without replyTo quotes nothing")
  assert.ok(bodies[1]?.includes("About that") && bodies[1].includes(first), "the reply quotes the tagged message")
  assert.ok(bodies[2]?.includes("👍") && bodies[2].includes(second), "a reaction without a tag lands on the latest message")
  assert.ok(bodies[3]?.includes("🎉") && bodies[3].includes(first), "a reaction with a tag lands on that message")
  assert.equal(posts.filter((body) => body.includes("typing_indicator") && body.includes(second)).length, 1, "typing starts once, when the step starts, on the latest message")
  assert.ok(posts[0]?.includes("typing_indicator"), "the typing goes first, so the step's messages end it")
})

test("a file goes out once chat_file has run, by the public link it returned; a failed chat_file or another tool's result sends nothing", async () => {
  const thread = await chatThread()
  const fileId = crypto.randomUUID()
  await db.orm.public.File.create({ id: fileId, personaId: persona.personaId, size: 10, name: "brief.pdf", contentType: "application/pdf" })
  const brief = `https://example.test/${persona.personaId}/${fileId}`
  const handle = whatsapp.events["call.settled"]
  assert.ok(handle)

  const results = [
    settledCall("chat_file", { url: brief, name: "brief.pdf", contentType: "application/pdf", size: 10 }),
    settledCall("chat_file", "That file id is not real.", "failed"),
    settledCall("web_fetch", { url: brief }),
  ]
  for (const result of results) await handle(result.event as never, { channel: { thread }, view: result.view } as never)

  assert.deepEqual(thread.posted, [{ raw: "", attachments: [{ type: "file", url: brief, name: "brief.pdf", mimeType: "application/pdf" }] }])
})

test("typing shows on the person's latest message when a turn starts and when each step starts, before the step's messages, which end it", async () => {
  const latest = `wamid.latest-${crypto.randomUUID()}`
  await receive({ id: latest, type: "text", text: { body: "hi" } })
  calls.length = 0

  const thread = await chatThread()
  const started = whatsapp.events["turn.started"]
  const requested = whatsapp.events["call.requested"]
  const resulted = whatsapp.events["call.settled"]
  assert.ok(started && requested && resulted)
  const step = async (texts: string[]) => {
    await requested({ type: "call.requested", data: { callId: crypto.randomUUID(), owner: { runId: "run_test" }, capability: { kind: "tool", name: "chat_say" } }, scope: { turnId: "turn_typing" } } as never, { channel: { thread } } as never)
    for (const text of texts) { const result = toolResult("chat_say", { text }); await resulted(result.event as never, { channel: { thread }, view: result.view } as never) }
  }
  const posts = () => calls.filter((call) => call.method === "POST" && call.url.pathname.endsWith("/messages")).map((call) => call.body)
  const typed = () => posts().filter((body) => body.includes("typing_indicator") && body.includes(latest)).length

  await started({ type: "turn.started", data: { turnId: "turn_typing", cause: {}, follows: null } } as never, { channel: { thread } } as never)
  assert.equal(typed(), 1, "a turn that starts")
  await step(["Checking."])
  assert.equal(typed(), 2, "a step that starts")
  assert.match(posts().at(-1) ?? "", /Checking\./, "the step's message goes out after the typing, so it ends it")
  await step(["Done."])
  assert.equal(typed(), 3, "every step")
  assert.match(posts().at(-1) ?? "", /Done\./, "the last answer leaves no typing behind")
})

test("the persona's own text reaches no one, and a failed turn tells the person", async () => {
  const thread = await chatThread()
  const completed = whatsapp.events["content.completed"]
  assert.ok(completed, "the channel answers content.completed itself, or eve's default posts the text")
  await completed({ type: "content.completed", data: { partId: "part_test", runId: "run_test", kind: "text", phase: "reply", value: "Sent two facts." } } as never, { channel: { thread } } as never)
  assert.deepEqual(thread.posted, [])

  assert.equal(calls.length, 0)

  const failed = whatsapp.events["turn.settled"]
  assert.ok(failed)
  await failed({ type: "turn.settled", data: { turnId: "turn_test", outcome: "failed", error: { code: "TEST", message: "The model failed." } } } as never, { channel: { thread } } as never)
  assert.match(sentTexts(), /Something went wrong on my side/)
})
