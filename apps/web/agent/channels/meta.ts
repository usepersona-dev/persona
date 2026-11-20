import { createRedisState } from "@chat-adapter/state-redis"
import { createWhatsAppAdapter, WhatsAppAdapter, type WhatsAppRawMessage, type WhatsAppThreadId } from "@chat-adapter/whatsapp"
import { BaseFormatConverter, codeBlock, ConsoleLogger, MessageHistoryCache, paragraph, parseMarkdown, strong, tableToAscii, walkAst, type AdapterPostableMessage, type ChatInstance, type Content, type EmojiValue, type Message, type Root, type Thread, type WebhookOptions } from "chat"
import type { MessageContent, MessageFilePart } from "eve/channels"
import { chatSdkChannel, type ChatSdkChannelEvents } from "eve/channels/chat-sdk"
import { call } from "eve/events"
import { toolResultFrom } from "eve/tools"
import { createHash } from "node:crypto"

import chatFile from "@/agent/tools/chat_file"
import chatReact from "@/agent/tools/chat_react"
import chatSay from "@/agent/tools/chat_say"
import { toPrincipal } from "@/usecases/agent"
import type { Caller } from "@/usecases/auth"
import { getFileSignedUrl, saveFile } from "@/usecases/files"
import { findLinkedPersona, redeemLinkCode } from "@/usecases/links"
import { transcribeAudio } from "@/usecases/media"
import { clearChat, resetChat } from "@/usecases/sessions"
import { readMetaLine } from "@/usecases/whatsapp-meta"

// WhatsApp straight through Meta's Cloud API, on Persona's shared number and on numbers in the customers' own Meta accounts. Each number answers at /eve/v1/meta/<its phone number id> with its own keys (the shared number's sit in env), and a chat is one conversation with one persona. A message from the person links the chat, starts it over, or goes to the persona with a tag it can point at. The persona answers only through the chat tools, which this channel carries out

type Address = { channel: "whatsapp_meta"; line: string; externalId: string }
type LineThread = WhatsAppThreadId & { personaId?: string; linkId?: string }
type WebhookBody = { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string } } }[] }[] }

const REPLIES = {
  stranger: "Hi! This chat isn't connected to a persona yet. If you have a link code, send it like this: link 1a2b3c4d",
  unreadable: "I can't read that kind of message yet. Send text, a photo, a voice note or a file.",
  failed: "Something went wrong on my side. Try again in a moment. If it keeps happening, send /clear to clear our chat or /reset to start a new one.",
  cleared: "Cleared our chat.",
  reset: "Started a new chat.",
}

const LINK_CODE = /^\/?link\s+([a-f0-9]{8})$/i
const VOICE = /^audio\/(ogg|opus)/
const SEEN = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]
const WEB = /^https?:\/\//
const WEEK_MS = 7 * 24 * 60 * 60_000
const logger = new ConsoleLogger("warn")

// One adapter for every number, as the Telegram channel has one for every bot: a webhook opens the number its address names, and a message out opens the number its thread names, each with that number's own keys. The persona sits in the thread id, as on our other numbers
class MetaLines extends WhatsAppAdapter {
  constructor() {
    super({ accessToken: "", appSecret: "", phoneNumberId: "", verifyToken: "", userName: "persona", logger })
  }

  async initialize(chat: ChatInstance) {
    this.chat = chat
  }

  // The line checks Meta's signature with its app's secret, and answers Meta's check of the address with its verify token
  async handleWebhook(request: Request, options?: WebhookOptions) {
    const phoneNumberId = new URL(request.url).pathname.split("/").at(-1) ?? ""
    const line = await this.openLine(phoneNumberId)
    if (!line) return new Response("This WhatsApp number is not connected.", { status: 404 })

    // [TEMP] Meta's signature only proves which app sent the body, and a project's own number comes with its owner's app. So the number inside the body must be the number in the address; a body that names another number is dropped
    const body = (await request.clone().json().catch(() => null)) as WebhookBody | null
    const changes = body?.entry?.flatMap((entry) => entry.changes ?? []) ?? []
    const numbers = changes.map((change) => change.value?.metadata?.phone_number_id).filter(Boolean)
    const sameNumber = numbers.every((number) => number === phoneNumberId)
    if (!sameNumber) return new Response("ok")

    const response = await line.handleWebhook(request, options)
    return response
  }

  async postMessage(threadId: string, message: AdapterPostableMessage) {
    const { phoneNumberId, userWaId } = this.decodeThreadId(threadId)
    const line = await this.lineOf(phoneNumberId)
    const sent = await line.postMessage(`whatsapp:${phoneNumberId}:${userWaId}`, message)
    return sent
  }

  async reply(threadId: string, messageId: string, message: AdapterPostableMessage) {
    const { phoneNumberId, userWaId } = this.decodeThreadId(threadId)
    const line = await this.lineOf(phoneNumberId)
    const sent = await line.reply(`whatsapp:${phoneNumberId}:${userWaId}`, messageId, message)
    return sent
  }

  // Marks the person's latest message read with WhatsApp's typing dots, found in the Chat SDK's history of the chat
  async startTyping(threadId: string) {
    const { phoneNumberId, userWaId } = this.decodeThreadId(threadId)
    const line = await this.lineOf(phoneNumberId)
    await line.startTyping(`whatsapp:${phoneNumberId}:${userWaId}`)
  }

  async addReaction(threadId: string, messageId: string, emoji: EmojiValue | string) {
    const { phoneNumberId, userWaId } = this.decodeThreadId(threadId)
    const line = await this.lineOf(phoneNumberId)
    await line.addReaction(`whatsapp:${phoneNumberId}:${userWaId}`, messageId, emoji)
  }

  encodeThreadId(thread: LineThread) {
    const id = ["whatsapp", thread.phoneNumberId, thread.userWaId, thread.personaId, thread.linkId].filter(Boolean).join(":")
    return id
  }

  decodeThreadId(threadId: string): LineThread {
    const [, phoneNumberId = "", userWaId = "", personaId] = threadId.split(":")
    const thread = { phoneNumberId, userWaId, personaId }
    return thread
  }

  channelIdFromThreadId(threadId: string) {
    const { phoneNumberId, userWaId } = this.decodeThreadId(threadId)
    const id = this.encodeThreadId({ phoneNumberId, userWaId })
    return id
  }

  private async openLine(phoneNumberId: string) {
    const keys = await readMetaLine(phoneNumberId)
    if (!keys.ok) return null

    const { accessToken, appSecret, verifyToken } = keys.value
    const adapter = createWhatsAppAdapter({ accessToken, appSecret, phoneNumberId, verifyToken, userName: "persona", logger })
    await adapter.initialize(this.chat!)
    return adapter
  }

  private async lineOf(phoneNumberId: string) {
    const line = await this.openLine(phoneNumberId)
    if (!line) throw new Error("This WhatsApp number is not connected to Persona.")
    return line
  }
}

// Markdown in WhatsApp's own markers: *bold*, _italic_, ~strike~, `code` and ``` blocks, "> " quotes and lists. The adapter's own converter writes these markers too, but it leaves links as markdown ("[name](address)", "<address>"), so replies go out raw, through this one. WhatsApp has no link syntax and no escapes, so a named link reads "name (address)" and text goes out as written
class WhatsappText extends BaseFormatConverter {
  fromAst(ast: Root) {
    const text = this.fromAstWithNodeConverter(ast, (node) => this.nodeToText(node))
    return text.trim()
  }

  toAst(platformText: string) {
    const ast = parseMarkdown(platformText)
    return ast
  }

  private nodeToText(node: Content): string {
    if (node.type === "text") return node.value
    if (node.type === "paragraph") return this.childrenToText(node.children)
    if (node.type === "strong") return `*${this.childrenToText(node.children)}*`
    if (node.type === "emphasis") return `_${this.childrenToText(node.children)}_`
    if (node.type === "delete") return `~${this.childrenToText(node.children)}~`
    if (node.type === "inlineCode") return `\`${node.value}\``
    if (node.type === "code") return `\`\`\`\n${node.value}\n\`\`\``
    if (node.type === "blockquote") return this.childrenToText(node.children).split("\n").map((line) => `> ${line}`).join("\n")
    if (node.type === "break") return "\n"
    if (node.type === "thematicBreak") return "---"
    if (node.type === "list") return this.renderList(node, 0, (child) => this.nodeToText(child))

    if (node.type === "link") {
      const label = this.childrenToText(node.children)
      if (!label || label === node.url) return node.url
      return `${label} (${node.url})`
    }

    return this.defaultNodeToText(node, (child) => this.nodeToText(child))
  }

  private childrenToText(children: Content[]) {
    const text = children.map((child) => this.nodeToText(child)).join("")
    return text
  }
}

const meta = new MetaLines()
const converter = new WhatsappText()

export const events: ChatSdkChannelEvents<{ whatsapp: typeof meta }> = {
  async "turn.settled"(event, ctx) {
    if (!ctx.channel.thread) return
    if (event.data.outcome === "failed") await reply(ctx.channel.thread, REPLIES.failed)
  },
  async "session.ended"(event, ctx) {
    if (!ctx.channel.thread) return
    if (event.data.outcome === "failed") await reply(ctx.channel.thread, REPLIES.failed)
  },
  async "content.completed"() { }, // eve posts a turn's last text by default; the persona's own text reaches no one
  async "turn.started"(_event, ctx) { // Typing shows when a turn starts: WhatsApp drops it when we send a message, so the last answer leaves none behind, or after about 25 seconds
    if (!ctx.channel.thread) return
    await bot.initialize()
    await meta.startTyping(ctx.channel.thread.id).catch((error) => console.error("WhatsApp typing failed.", error))
  },
  async "call.settled"(event, ctx) { // The chat tools pass their input through, and each call is carried out here once it has run, so a call that failed or did not run sends nothing. A result is read with the tool's own schema; any other tool belongs to the agent alone
    const thread = ctx.channel.thread
    if (!thread) return

    const called = call(ctx.view, event.data.callId)
    const say = toolResultFrom(called, chatSay)
    const file = toolResultFrom(called, chatFile)
    const reaction = toolResultFrom(called, chatReact)
    if (!say && !file && !reaction) return

    await bot.initialize()
    if (say) await reply(thread, say.output.text, say.output.replyTo)
    if (file) await sendFile(thread, file.output)
    if (reaction) await react(thread, reaction.output.emoji, reaction.output.to)
  },
}

export const { bot, channel, send } = chatSdkChannel({
  userName: "persona",
  adapters: { whatsapp: meta },
  routes: { whatsapp: "/eve/v1/meta/:phoneNumberId" },
  state: createRedisState({ keyPrefix: "chat:meta" }),
  concurrency: "concurrent",
  streaming: false,
  logger: "warn",
  events,
})

// A chat is one link: its address holds the persona and the link's id, so a chat linked again, on a new link, is a new chat
export function encodeThreadId(phoneNumberId: string, userWaId: string, personaId: string, linkId: string) {
  const id = meta.encodeThreadId({ phoneNumberId, userWaId, personaId, linkId })
  return id
}

// The person on a chat, as the agent sees them: the reports act as them too, so a session at their thread is always theirs
export function encodePrincipal(orgId: string, link: { id: string; personaId: string; line: string; externalId: string }) {
  const caller: Caller = { orgId, userId: `whatsapp_meta:${link.line}:${link.externalId}` }
  const auth = toPrincipal({ ...caller, personaId: link.personaId, linkId: link.id, channel: "whatsapp" })
  return { caller, auth }
}

// ## Incoming

async function onMessage(thread: Thread, message: Message) {
  try {
    const answer = await receive(thread, message)
    if (answer) await reply(thread, answer)
  } catch (error) {
    console.error("A WhatsApp message on a Meta number failed.", error)
    await reply(thread, REPLIES.failed)
  }
}

// Returns what to answer the person, or null once the persona has the message
async function receive(thread: Thread, message: Message): Promise<string | null> {
  const { phoneNumberId, userWaId } = meta.decodeThreadId(thread.id)
  await meta.startTyping(thread.id).catch((error) => console.error("WhatsApp typing failed.", error))
  const address: Address = { channel: "whatsapp_meta", line: phoneNumberId, externalId: userWaId }
  const text = message.text.trim()

  const code = LINK_CODE.exec(text)?.[1]
  if (code) {
    const redeemed = await redeemLinkCode({ ...address, code, label: message.author.fullName || message.author.userId, phone: phoneOf(message) })
    if (!redeemed.ok) return redeemed.error.message
    const answer = `You're connected to ${redeemed.value.personaName}. Say hi!`
    return answer
  }

  const linked = await findLinkedPersona(address)
  if (!linked.ok) throw new Error(linked.error.message)
  if (!linked.value) return REPLIES.stranger
  const { persona } = linked.value

  const { caller, auth } = encodePrincipal(persona.orgId, linked.value)
  const threadId = encodeThreadId(phoneNumberId, userWaId, persona.id, linked.value.id)
  const chat = `meta:${threadId}`

  if (text.toLowerCase() === "/clear") {
    const cleared = await clearChat(caller, chat)
    if (!cleared.ok) throw new Error(cleared.error.message)
    return REPLIES.cleared
  }
  if (text.toLowerCase() === "/reset") {
    const reset = await resetChat(caller, chat)
    if (!reset.ok) throw new Error(reset.error.message)
    return REPLIES.reset
  }

  const tag = tagOf(message.id)
  const quote = await quoteOf(thread, message)
  const content = await contentOf(caller, persona.id, message, tag, quote)
  if (!content) return REPLIES.unreadable

  // The platform's id of the message, kept a week under its tag and as the latest, for the chat tools to react or reply to
  const state = bot.getState()
  await state.set(`message:${threadId}:${tag}`, message.id, WEEK_MS)
  await state.set(`message:${threadId}:latest`, message.id, WEEK_MS)

  const target = { ...thread.toJSON(), id: threadId, channelId: meta.channelIdFromThreadId(threadId) }
  // The platform message id is the delivery key: a webhook retried after eve accepted the message runs no second turn, and one retried before it still gets in
  await send(content, { thread: target, auth, idempotencyKey: message.id })
  return null
}

// What the persona reads: the tag, what a reply quotes, the text, and each attachment saved to the persona's files, as our own transcript for a voice note and as a file the model can see for a picture or a PDF. Meta's media is downloaded with the line's token, by the adapter
async function contentOf(caller: Caller, personaId: string, message: Message, tag: string, quote: string | null): Promise<MessageContent | null> {
  const raw = message.raw as WhatsAppRawMessage
  const lines: string[] = []
  const seen: MessageFilePart[] = []
  if (quote) lines.push(quote)
  if (message.text) lines.push(message.text)

  for (const attachment of message.attachments) {
    if (!attachment.fetchData) continue

    const data = await attachment.fetchData()
    const bytes = new Uint8Array(data)
    // Meta names the type with its codec, as in "audio/ogg; codecs=opus"
    const contentType = (attachment.mimeType ?? "application/octet-stream").split(";")[0].trim()
    let name = `${attachment.type}.${contentType.split("/")[1]}`
    if (attachment.name?.trim()) name = attachment.name.slice(0, 255)
    const saved = await saveFile(caller, personaId, { name, contentType, bytes })
    if (!saved.ok) throw new Error(saved.error.message)
    const file = saved.value
    const signedUrl = await getFileSignedUrl(caller, file.id)
    if (!signedUrl.ok) throw new Error(signedUrl.error.message)

    let transcript: string | null = null
    if (VOICE.test(contentType) || raw.message.audio?.voice) {
      const heard = await transcribeAudio(caller, personaId, bytes)
      if (heard.ok) transcript = heard.value.text
    }
    if (transcript !== null) lines.push(`[Voice note, file id ${file.id}] ${transcript}`)
    if (transcript === null) lines.push(`[Sent ${file.name} (${contentType}), file id ${file.id}]`)
    if (SEEN.includes(contentType)) seen.push({ type: "file", data: new URL(signedUrl.value), mediaType: contentType, filename: file.name })
  }

  if (lines.length === 0) return null

  const said = `[#${tag}] ${lines.join("\n")}`
  if (seen.length === 0) return said
  const content: MessageContent = [{ type: "text", text: said }, ...seen]
  return content
}

// What a reply quotes, so the persona knows which message the person means. Meta sends only the quoted message's id and can't return a message by it: one of the persona's own is found among what it sent this week, and one of the person's own messages is found in the Chat SDK's history of the chat, which keeps what came in, and carries the tag the persona saw on it. A failed lookup is logged, and the message still goes in
async function quoteOf(thread: Thread, message: Message) {
  const raw = message.raw as WhatsAppRawMessage
  const quotedId = raw.message.context?.id
  if (!quotedId) return null

  const said = await bot.getState().get<string>(`sent:${quotedId}`).catch(() => null)
  if (said) return `[Replying to your message: "${said.slice(0, 300)}"]`

  const history = await new MessageHistoryCache(bot.getState()).getMessages(thread.id).catch((error) => {
    console.error("A quoted WhatsApp message could not be read.", error)
    return []
  })
  const quoted = history.find((one) => one.id === quotedId)
  if (!quoted || quoted.author.isMe) return "[Replying to an earlier message]"

  const whose = `their message #${tagOf(quotedId)}`
  if (!quoted.text) return `[Replying to ${whose} (${quoted.attachments[0]?.type ?? "file"})]`

  let shown = quoted.text
  if (shown.length > 300) shown = `${shown.slice(0, 300)}…`
  return `[Replying to ${whose}: "${shown}"]`
}

// ## Chat tools

// One message in WhatsApp's own markers. With replyTo, it quotes that message of the person's
export async function reply(thread: Pick<Thread, "id">, markdown: string, replyTo?: string) {
  const text = render(markdown)

  let quoted: string | null = null
  if (replyTo) quoted = await findMessage(thread.id, replyTo)

  const sent = quoted ? await meta.reply(thread.id, quoted, { raw: text }) : await meta.postMessage(thread.id, { raw: text })
  await bot.getState().set(`sent:${sent.id}`, markdown, WEEK_MS).catch((error) => console.error("A sent WhatsApp message could not be kept.", error))
}

// One of our files goes as real media with its name, by its public link
export async function sendFile(thread: Pick<Thread, "id">, file: { id: string; url: string; name: string; contentType: string }) {
  const sent = await meta.postMessage(thread.id, { raw: "", attachments: [{ type: kindOf(file.contentType), url: file.url, name: file.name, mimeType: file.contentType }] })
  await bot.getState().set(`sent:${sent.id}`, `${file.name}, file id ${file.id}`, WEEK_MS).catch((error) => console.error("A sent WhatsApp message could not be kept.", error))
}

// The reaction lands on the tagged message, or on the person's latest. A failed reaction is logged, and the rest of the turn goes on
async function react(thread: Thread, emoji: string, to?: string) {
  let messageId: string | null = null
  if (to) messageId = await findMessage(thread.id, to)
  if (!to) messageId = await bot.getState().get<string>(`message:${thread.id}:latest`)
  if (!messageId) return

  await meta.addReaction(thread.id, messageId, emoji).catch((error) => console.error("A WhatsApp reaction failed.", error))
}

// One pass from markdown to WhatsApp's own markers, by WhatsappText. What WhatsApp lacks goes back to text first: a heading turns bold, a table turns monospace, a picture is its link, and a mail or phone link is its bare address, which the converter would otherwise print as "address (mailto:address)"
function render(markdown: string) {
  const ast = walkAst(parseMarkdown(markdown), (node) => {
    if (node.type === "heading") return paragraph([strong(node.children)])
    if (node.type === "table") return codeBlock(tableToAscii(node))
    if (node.type === "image") return { type: "text", value: node.url }
    if (node.type === "link" && !WEB.test(node.url)) return { type: "text", value: node.url.replace(/^(mailto|tel):/, "") }
    return node
  })
  const text = converter.fromAst(ast)
  return text
}

// ## Message tags

// WhatsApp's own message ids are long, so the tag the persona sees is a short hash of one
function tagOf(messageId: string) {
  const tag = createHash("sha256").update(messageId).digest("hex").slice(0, 6)
  return tag
}

async function findMessage(threadId: string, tag: string) {
  const messageId = await bot.getState().get<string>(`message:${threadId}:${tag.replace(/^#/, "")}`)
  return messageId
}

// ## Helpers

// The person's phone, which the link keeps: Meta's wa_id is the phone's digits. A person with only a WhatsApp user id (BSUID) has none
function phoneOf(message: Message) {
  const raw = message.raw as WhatsAppRawMessage
  const waId = raw.contact?.wa_id ?? raw.message.from
  if (waId && /^\d+$/.test(waId)) return `+${waId}`
  return null
}

function kindOf(contentType = "") {
  if (contentType === "image/jpeg" || contentType === "image/png") return "image" as const
  if (contentType.startsWith("video/")) return "video" as const
  if (contentType.startsWith("audio/")) return "audio" as const
  return "file" as const
}

bot.onDirectMessage(onMessage)

export default channel
