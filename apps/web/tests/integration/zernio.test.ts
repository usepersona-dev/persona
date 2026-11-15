import assert from "node:assert/strict"
import { createHash, createHmac, randomBytes } from "node:crypto"
import { afterAll, afterEach, beforeAll, test } from "vitest"

import { db } from "@/prisma/db"
import { createLinkCode } from "@/usecases/links"
import { createTestPersona, settledCall } from "@/tests/helpers"

type Sent = { address: string; message: unknown; options: { auth: { attributes: Record<string, string> } } }
type Route = { method: string; path: string; handler: (request: Request, args: never) => Promise<Response> }
type Call = { url: URL; method: string; body: string; auth: string | null }

const SECRET = "zernio-test-secret"
const SHARED = objectId()
const ELSEWHERE = objectId()
const FAN = "15550001111"

const realFetch = globalThis.fetch
const calls: Call[] = []
const sends: Sent[] = []
const history: Record<string, unknown>[] = []
let persona: Awaited<ReturnType<typeof createTestPersona>>
let zernio: typeof import("@/agent/channels/zernio")
let automations: typeof import("@/agent/channels/automations")

beforeAll(async () => {
  process.env.ZERNIO_WEBHOOK_SECRET = SECRET
  process.env.ZERNIO_WHATSAPP_ACCOUNT_ID = SHARED
  process.env.AUTOMATIONS_SECRET ??= "automations-test-secret"
  globalThis.fetch = fake as typeof fetch
  zernio = await import("@/agent/channels/zernio")
  automations = await import("@/agent/channels/automations")
  persona = await createTestPersona("zernio")
})

afterEach(() => {
  calls.length = 0
  sends.length = 0
  history.length = 0
})

afterAll(async () => {
  await persona.cleanup()
  globalThis.fetch = realFetch
  await db.close()
})

async function fake(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init)
  const url = new URL(request.url)
  if (url.hostname !== "zernio.com" && url.hostname !== "media.test") return realFetch(input, init)

  const body = await request.text()
  calls.push({ url, method: request.method, body, auth: request.headers.get("authorization") })
  if (url.hostname === "media.test" && url.pathname.endsWith(".pdf")) return new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } })
  if (url.hostname === "media.test" || url.pathname.includes("/whatsapp/media/")) return new Response("JPEGBYTES", { headers: { "content-type": "image/jpeg" } })
  if (request.method === "GET" && url.pathname.endsWith("/messages")) return Response.json({ status: "success", messages: history })
  return Response.json({ success: true, data: { messageId: `wamid.out-${crypto.randomUUID()}`, conversationId: "conversation" } })
}

// A message as Zernio's webhook sends it, signed with the secret, through the channel's route. A reply's metadata (the quoted message) goes beside the message, where Zernio puts it
async function receive(accountId: string, conversationId: string, message: Record<string, unknown>, signature?: string) {
  const { metadata, ...fields } = message
  const payload = {
    id: crypto.randomUUID(),
    event: "message.received",
    timestamp: new Date().toISOString(),
    message: { id: objectId(), conversationId, platform: "whatsapp", platformMessageId: `wamid.${crypto.randomUUID()}`, direction: "incoming", text: "hi", attachments: [], sender: { id: FAN, name: "Dana" }, sentAt: new Date().toISOString(), isRead: false, ...fields },
    conversation: { id: conversationId, platformConversationId: FAN, participantId: FAN, participantName: "Dana", status: "active" },
    account: { id: accountId, platform: "whatsapp", username: "+1 555-0100" },
    metadata,
  }
  const body = JSON.stringify(payload)
  const signed = signature ?? createHmac("sha256", SECRET).update(body).digest("hex")
  const request = new Request("https://persona.test/eve/v1/zernio", { method: "POST", headers: { "content-type": "application/json", "x-zernio-signature": signed }, body })

  const route = (zernio.channel.routes as unknown as Route[]).find((candidate) => candidate.method === "POST")
  if (!route) throw new Error("The Zernio channel has no POST route.")

  const tasks: Promise<unknown>[] = []
  const from = (address: string) => ({ send: async (sent: unknown, options: Sent["options"]) => void sends.push({ address, message: sent, options }) })
  const response = await route.handler(request, { params: {}, from, waitUntil: (task: Promise<unknown>) => void tasks.push(task) } as never)
  for (let index = 0; index < tasks.length; index += 1) await tasks[index]
  return response
}

async function link(conversationId: string) {
  const linkCode = await createLinkCode(persona.caller, persona.personaId)
  assert.ok(linkCode.ok)
  await receive(SHARED, conversationId, { text: `link ${linkCode.value.code}` })
  calls.length = 0
}

function messages() {
  const sent = calls.filter((call) => call.method === "POST" && call.url.pathname.endsWith("/messages")).map((call) => ({ conversation: call.url.pathname.split("/").at(-2), ...(JSON.parse(call.body) as { accountId?: string; message?: string; replyTo?: string; attachmentUrl?: string; attachmentType?: string; attachmentName?: string }) }))
  return sent
}

function objectId() {
  return randomBytes(12).toString("hex")
}

// One call's result the way eve hands it to the channel once the tool has run; the chat tools pass their input through
function toolResult(toolName: string, output: unknown) {
  const result = settledCall(toolName, output)
  return result
}

test("a stranger on the shared number is asked for a link code, the code links the conversation, and then a message reaches that persona's own session", async () => {
  const conversation = objectId()
  await receive(SHARED, conversation, { text: "hi" })
  assert.match(messages()[0]?.message ?? "", /isn't connected to a persona yet/)
  assert.equal(messages()[0]?.conversation, conversation)
  assert.equal(messages()[0]?.accountId, SHARED)
  assert.ok(calls.some((call) => call.url.pathname.endsWith(`/conversations/${conversation}/typing`)))

  const linkCode = await createLinkCode(persona.caller, persona.personaId)
  assert.ok(linkCode.ok)
  await receive(SHARED, conversation, { text: `link ${linkCode.value.code}` })
  assert.match(messages()[1]?.message ?? "", /You're connected to/)

  await receive(SHARED, conversation, { text: "hello" })
  assert.equal(sends.length, 1)
  assert.equal(sends[0]?.address, `zernio:${SHARED}:${conversation}:${persona.personaId}`)
  assert.match(String(sends[0]?.message), /^\[#[0-9a-f]{6}\] hello$/)
  const linked = await db.orm.public.Link.where({ channel: "whatsapp_v2", line: SHARED, externalId: conversation }).first()
  assert.equal(linked?.label, "Dana")
  assert.equal(linked?.phone, `+${FAN}`)
  assert.deepEqual(sends[0]?.options.auth.attributes, { orgId: persona.caller.orgId, userId: `whatsapp_v2:${SHARED}:${conversation}`, personaId: persona.personaId, linkId: linked?.id, channel: "whatsapp" })
})

test("a code works on a connected line of the persona's own project, and not on another project's line", async () => {
  const own = objectId()
  const foreign = objectId()
  const other = await createTestPersona("zernio-other")
  const project = await db.orm.public.Persona.where({ id: persona.personaId }).first()
  const otherProject = await db.orm.public.Persona.where({ id: other.personaId }).first()
  await db.orm.public.WhatsappLine.create({ projectId: project?.projectId ?? "", profileId: objectId(), accountId: own, number: "+1 555 0101" })
  await db.orm.public.WhatsappLine.create({ projectId: otherProject?.projectId ?? "", profileId: objectId(), accountId: foreign, number: "+1 555 0102" })

  const linkCode = await createLinkCode(persona.caller, persona.personaId)
  assert.ok(linkCode.ok)
  const conversation = objectId()
  await receive(foreign, conversation, { text: `link ${linkCode.value.code}` })
  assert.match(messages()[0]?.message ?? "", /does not work on this number/)
  assert.equal(messages()[0]?.accountId, foreign)

  await receive(own, conversation, { text: `link ${linkCode.value.code}` })
  assert.match(messages()[1]?.message ?? "", /You're connected to/)
  await receive(own, conversation, { text: "hello" })
  assert.equal(sends[0]?.address, `zernio:${own}:${conversation}:${persona.personaId}`)
  await other.cleanup()
})

test("another Zernio number gets no answer, and a webhook without Zernio's signature, or with no secret set, is refused", async () => {
  const quiet = await receive(ELSEWHERE, objectId(), { text: "hi" })
  assert.equal(quiet.status, 200)
  assert.equal(calls.length, 0)
  assert.equal(sends.length, 0)

  const forged = await receive(SHARED, objectId(), { text: "hi" }, "0".repeat(64))
  assert.equal(forged.status, 401)

  delete process.env.ZERNIO_WEBHOOK_SECRET
  const unset = await receive(SHARED, objectId(), { text: "hi" })
  process.env.ZERNIO_WEBHOOK_SECRET = SECRET
  assert.equal(unset.status, 401)
  assert.equal(calls.length, 0)
  assert.equal(sends.length, 0)
})

test("a reply reads as WhatsApp: links stay where they are, a bare address stays plain, a heading turns bold and a table turns monospace", () => {
  const text = zernio.render("# Your week\n\nMore on [our site](https://usepersona.dev/about) or https://example.com/docs, or write to info@usepersona.dev or [the shop](tel:+15551234567).\n\n| Day | Plan |\n| --- | --- |\n| Mon | Gym |")

  assert.match(text, /^\*Your week\*/)
  assert.match(text, /More on our site \(https:\/\/usepersona\.dev\/about\) or https:\/\/example\.com\/docs, or write to info@usepersona\.dev or \+15551234567\./)
  assert.match(text, /```[\s\S]*Day[\s\S]*Mon[\s\S]*```/)
})

test("each chat tool call goes out once it has run: a message, a quoted reply, and a reaction on the tagged or the latest message; a failed call and any other tool send nothing", async () => {
  const conversation = objectId()
  const first = `wamid.first-${crypto.randomUUID()}`
  const second = `wamid.second-${crypto.randomUUID()}`
  await link(conversation)
  await receive(SHARED, conversation, { platformMessageId: first, text: "first" })
  await receive(SHARED, conversation, { platformMessageId: second, text: "second" })
  const tag = /^\[#([0-9a-f]{6})\]/.exec(String(sends[0]?.message))?.[1] ?? ""
  calls.length = 0

  const thread = { id: `zernio:${SHARED}:${conversation}:${persona.personaId}` }
  const requested = zernio.events["call.requested"]
  const handle = zernio.events["call.settled"]
  assert.ok(requested && handle)
  await requested({ type: "call.requested", data: { callId: crypto.randomUUID(), owner: { runId: "run_test" }, capability: { kind: "tool", name: "chat_say" } }, scope: { turnId: "turn_test" } } as never, { channel: { thread } } as never)
  const results = [toolResult("chat_say", { text: "Hello **there**" }), toolResult("chat_say", { text: "About that", replyTo: tag }), toolResult("chat_react", { emoji: "👍" }), toolResult("chat_react", { emoji: "🎉", to: tag }), toolResult("web_search", { text: "moon" }), settledCall("chat_say", "Invalid input", "failed")]
  for (const result of results) await handle(result.event as never, { channel: { thread }, view: result.view } as never)

  assert.deepEqual(messages().map((sent) => [sent.message, sent.replyTo]), [["Hello *there*", undefined], ["About that", first]])
  const reactions = calls.filter((call) => call.url.pathname.endsWith("/reactions")).map((call) => ({ messageId: call.url.pathname.split("/").at(-2), emoji: (JSON.parse(call.body) as { emoji: string }).emoji }))
  assert.deepEqual(reactions, [{ messageId: second, emoji: "👍" }, { messageId: first, emoji: "🎉" }])
})

test("a file goes out once chat_file has run, by its public link with its name and kind", async () => {
  const conversation = objectId()
  const fileId = crypto.randomUUID()
  await db.orm.public.File.create({ id: fileId, personaId: persona.personaId, size: 10, name: "brief.pdf", contentType: "application/pdf" })
  const brief = `https://example.test/${persona.personaId}/${fileId}`
  const handle = zernio.events["call.settled"]
  assert.ok(handle)

  const thread = { id: `zernio:${SHARED}:${conversation}:${persona.personaId}` }
  { const result = toolResult("chat_file", { url: brief, name: "brief.pdf", contentType: "application/pdf", size: 10 }); await handle(result.event as never, { channel: { thread }, view: result.view } as never) }

  assert.deepEqual(messages(), [{ conversation, accountId: SHARED, attachmentUrl: brief, attachmentType: "file", attachmentName: "brief.pdf" }])
})

test("a picture is fetched with Zernio's key and saved for the persona to see; a link on another host never gets the key; a document keeps its own name", async () => {
  const conversation = objectId()
  await link(conversation)
  await receive(SHARED, conversation, { text: "", attachments: [{ type: "image", url: `https://zernio.com/api/v1/whatsapp/media/m1?accountId=${SHARED}` }, { type: "image", url: "https://media.test/photo.jpg" }, { type: "file", url: "https://media.test/m2.pdf", payload: { mimeType: "application/pdf", filename: "Investor_Consent.pdf" } }] })

  const downloads = calls.filter((call) => call.method === "GET")
  assert.match(downloads[0]?.auth ?? "", /^Bearer /)
  assert.equal(downloads[1]?.auth, null)
  const content = sends[0]?.message as { type: string; text?: string }[]
  assert.match(content[0]?.text ?? "", /^\[#[0-9a-f]{6}\] \[Sent image\.jpeg \(image\/jpeg\), file id [0-9a-f-]{36}\]/)
  assert.match(content[0]?.text ?? "", /\n\[Sent Investor_Consent\.pdf \(application\/pdf\), file id [0-9a-f-]{36}\]/)
  assert.equal(content.filter((part) => part.type === "file").length, 3)
})

test("a reply tells the persona what it quotes: one of its own messages, one of the person's under the tag it saw, or an earlier one it can't find", async () => {
  const conversation = objectId()
  await link(conversation)
  history.push({ id: "wamid.mine", direction: "outgoing", message: "The kiln is free on Monday", attachments: [] }, { id: "wamid.theirs", direction: "incoming", message: "and on Tuesday?", attachments: [] })
  await receive(SHARED, conversation, { text: "what did you mean?", metadata: { quotedMessageId: "wamid.mine" } })
  await receive(SHARED, conversation, { text: "this one", metadata: { quotedMessageId: "wamid.theirs" } })
  await receive(SHARED, conversation, { text: "and that", metadata: { quotedMessageId: "wamid.gone" } })

  const tag = createHash("sha256").update("wamid.theirs").digest("hex").slice(0, 6)
  assert.match(String(sends[0]?.message), /^\[#[0-9a-f]{6}\] \[Replying to your message: "The kiln is free on Monday"\]\nwhat did you mean\?$/)
  assert.match(String(sends[1]?.message), new RegExp(`^\\[#[0-9a-f]{6}\\] \\[Replying to their message #${tag}: "and on Tuesday\\?"\\]\\nthis one$`))
  assert.match(String(sends[2]?.message), /^\[#[0-9a-f]{6}\] \[Replying to an earlier message\]\nand that$/)
  const lookup = calls.find((call) => call.method === "GET" && call.url.pathname.endsWith(`/conversations/${conversation}/messages`))
  assert.equal(lookup?.url.searchParams.get("accountId"), SHARED)
})

test("the persona's own text reaches no one, and a failed turn tells the person", async () => {
  const conversation = objectId()
  const thread = { id: `zernio:${SHARED}:${conversation}:${persona.personaId}` }
  const completed = zernio.events["content.completed"]
  assert.ok(completed, "the channel answers content.completed itself, or eve's default posts the text")
  await completed({ type: "content.completed", data: { partId: "part_test", runId: "run_test", kind: "text", phase: "reply", value: "Sent two facts." } } as never, { channel: { thread } } as never)
  assert.equal(calls.length, 0)

  const failed = zernio.events["turn.settled"]
  assert.ok(failed)
  await failed({ type: "turn.settled", data: { turnId: "turn_test", outcome: "failed", error: { code: "TEST", message: "The model failed." } } } as never, { channel: { thread } } as never)
  assert.match(messages()[0]?.message ?? "", /Something went wrong on my side/)
})

test("a report to a chat on a Zernio number goes out through the Zernio channel, in that chat's thread", async () => {
  const conversation = objectId()
  await link(conversation)
  const linked = await db.orm.public.Link.where({ channel: "whatsapp_v2", line: SHARED, externalId: conversation }).first()
  assert.ok(linked)
  const schedule = await db.orm.public.Schedule.create({ personaId: persona.personaId, linkId: linked.id, name: "Weekly", prompt: "Report the week.", enabled: false })
  const run = await db.orm.public.Run.create({ personaId: persona.personaId, source: "automation", title: schedule.name, linkId: linked.id, scheduleId: schedule.id, status: "completed", result: { summary: "Your weekly report", notify: true } })

  const route = (automations.default.routes as unknown as Route[]).find((candidate) => candidate.path === "/eve/v1/automations/:automationId/:runId/report")
  if (!route) throw new Error("The automations channel has no report route.")
  const posted: { channel: unknown; threadId: string; message: unknown }[] = []
  const to = (target: unknown, options: { threadId: string }) => ({ send: async (message: unknown) => void posted.push({ channel: target, threadId: options.threadId, message }) })
  const request = new Request(`https://persona.test/eve/v1/automations/${schedule.id}/${run.id}/report`, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  const response = await route.handler(request, { params: { automationId: schedule.id, runId: run.id }, to } as never)

  assert.equal(response.status, 202)
  assert.equal(posted.length, 1)
  assert.equal(posted[0]?.channel, zernio.channel)
  assert.equal(posted[0]?.threadId, `zernio:${SHARED}:${conversation}:${persona.personaId}`)
  assert.match(String(posted[0]?.message), /Your weekly report/)
})
