import { createPostgresState } from "@chat-adapter/state-pg"
import { ZernioAdapter, type ZernioRawMessage, type ZernioThreadId } from "@zernio/chat-sdk-adapter"
import { BaseFormatConverter, codeBlock, paragraph, parseMarkdown, strong, tableToAscii, walkAst, type Content, type Message, type Root, type Thread, type WebhookOptions } from "chat"
import type { MessageContent, MessageFilePart } from "eve/channels"
import { chatSdkChannel, type ChatSdkChannelEvents } from "eve/channels/chat-sdk"
import { call } from "eve/events"
import { toolResultFrom } from "eve/tools"
import { createHash } from "node:crypto"

import chatFile from "@/agent/tools/chat_file"
import chatReact from "@/agent/tools/chat_react"
import chatSay from "@/agent/tools/chat_say"
import { download, sendFile as sendAttachment, sendText } from "@/lib/zernio"
import { pool } from "@/prisma/db"
import { toPrincipal } from "@/usecases/agent"
import type { Caller } from "@/usecases/auth"
import { getFileSignedUrl, saveFile } from "@/usecases/files"
import { findLinkedPersona, redeemLinkCode } from "@/usecases/links"
import { transcribeAudio } from "@/usecases/media"
import { clearChat, resetChat } from "@/usecases/sessions"
import { isWhatsappAccount } from "@/usecases/whatsapp-meta"

// WhatsApp through Zernio, next to Kapso's: Persona's shared Zernio number and the projects' own lines, and a chat is one conversation with one persona. A message from the person links the chat, starts it over, or goes to the persona with a tag it can point at. The persona answers only through the chat tools, which this channel carries out

type Address = { channel: "whatsapp_v2"; line: string; externalId: string }
type LineThread = ZernioThreadId & { personaId?: string }

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
const FILES = ["image", "video", "audio", "file", "sticker"]
const WEB = /^https?:\/\//
const WEEK_MS = 7 * 24 * 60 * 60_000

// Zernio's adapter, with the persona in the thread id, as on Kapso's numbers
class ZernioLines extends ZernioAdapter {
  constructor() {
    super({ apiKey: process.env.ZERNIO_API_KEY || "none", webhookSecret: process.env.ZERNIO_WEBHOOK_SECRET, botName: "persona" })
  }

  // With no secret, the adapter takes unsigned webhooks and only warns; Kapso's refuses them, and so does this one
  async handleWebhook(request: Request, options?: WebhookOptions) {
    if (!process.env.ZERNIO_WEBHOOK_SECRET) return new Response("Webhook signature verification is not configured", { status: 401 })
    const response = await super.handleWebhook(request, options)
    return response
  }

  encodeThreadId(thread: LineThread) {
    const id = ["zernio", thread.accountId, thread.conversationId, thread.personaId].filter(Boolean).join(":")
    return id
  }

  decodeThreadId(threadId: string): LineThread {
    const [, accountId = "", conversationId = "", personaId] = threadId.split(":")
    const thread = { accountId, conversationId, personaId }
    return thread
  }

  channelIdFromThreadId(threadId: string) {
    const { accountId, conversationId } = this.decodeThreadId(threadId)
    const id = this.encodeThreadId({ accountId, conversationId })
    return id
  }
}

// Markdown in WhatsApp's own markers: *bold*, _italic_, ~strike~, `code` and ``` blocks, "> " quotes and lists. Zernio passes text through as it is, and its adapter's converter writes standard markdown. WhatsApp has no link syntax and no escapes, so a named link reads "name (address)" and text goes out as written
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

const zernio = new ZernioLines()
const converter = new WhatsappText()

export const events: ChatSdkChannelEvents<{ zernio: typeof zernio }> = {
  async "content.completed"() { },
  async "turn.settled"(event, ctx) {
    if (!ctx.channel.thread) return
    if (event.data.outcome === "failed") await reply(ctx.channel.thread, REPLIES.failed)
  },
  async "session.ended"(event, ctx) {
    if (!ctx.channel.thread) return
    if (event.data.outcome === "failed") await reply(ctx.channel.thread, REPLIES.failed)
  },
  async "turn.started"(_event, ctx) {
    if (!ctx.channel.thread) return
    await bot.initialize()
    // await zernio.startTyping(ctx.channel.thread.id) /
  },
  async "call.requested"(_event, ctx) {
    if (!ctx.channel.thread) return
    await bot.initialize()
    // await zernio.startTyping(ctx.channel.thread.id)
  },
  async "call.settled"(event, ctx) {
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
  adapters: { zernio },
  routes: { zernio: "/eve/v1/zernio" },
  state: createPostgresState({ client: pool, keyPrefix: "zernio", autoCreateSchema: false }),
  concurrency: "concurrent",
  streaming: false,
  logger: "warn",
  events,
})

export function encodeThreadId(accountId: string, conversationId: string, personaId: string) {
  const id = zernio.encodeThreadId({ accountId, conversationId, personaId })
  return id
}

// The person on a chat, as the agent sees them: the reports act as them too, so a session at their thread is always theirs
export function encodePrincipal(orgId: string, link: { id: string; personaId: string; line: string; externalId: string }) {
  const caller: Caller = { orgId, userId: `whatsapp_v2:${link.line}:${link.externalId}` }
  const auth = toPrincipal({ ...caller, personaId: link.personaId, linkId: link.id, channel: "whatsapp" })
  return { caller, auth }
}

// ## Incoming

async function onMessage(thread: Thread, message: Message) {
  try {
    const answer = await receive(thread, message)
    if (answer) await reply(thread, answer)
  } catch (error) {
    console.error("A Zernio message failed.", error)
    await reply(thread, REPLIES.failed)
  }
}

// Returns what to answer the person, or null once the persona has the message. A number this deployment does not have gets no answer, and no typing
async function receive(thread: Thread, message: Message): Promise<string | null> {
  const { accountId, conversationId } = zernio.decodeThreadId(thread.id)
  const ours = await isWhatsappAccount(accountId)
  if (!ours.ok) throw new Error(ours.error.message)
  if (!ours.value) return null

  await zernio.startTyping(thread.id)
  const address: Address = { channel: "whatsapp_v2", line: accountId, externalId: conversationId }
  const text = message.text.trim()

  const code = LINK_CODE.exec(text)?.[1]
  if (code) {
    const phone = phoneOf(message)
    const redeemed = await redeemLinkCode({ ...address, code, label: message.author.fullName || message.author.userId, phone })
    if (!redeemed.ok) return redeemed.error.message
    const answer = `You're connected to ${redeemed.value.personaName}. Say hi!`
    return answer
  }

  const linked = await findLinkedPersona(address)
  if (!linked.ok) throw new Error(linked.error.message)
  if (!linked.value) return REPLIES.stranger
  const { persona } = linked.value

  const { caller, auth } = encodePrincipal(persona.orgId, linked.value)
  const threadId = encodeThreadId(accountId, conversationId, persona.id)
  const chat = `zernio:${threadId}`

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

  const target = { ...thread.toJSON(), id: threadId, channelId: zernio.channelIdFromThreadId(threadId) }
  // The platform message id is the delivery key: a webhook retried after eve accepted the message runs no second turn, and one retried before it still gets in
  await send(content, { thread: target, auth, idempotencyKey: message.id })
  return null
}

// What the persona reads: the tag, what a reply quotes, the text, and each attachment saved to the persona's files, as our own transcript for a voice note (Zernio gives none for WhatsApp) and as a file the model can see for a picture or a PDF
async function contentOf(caller: Caller, personaId: string, message: Message, tag: string, quote: string | null): Promise<MessageContent | null> {
  const raw = message.raw as ZernioRawMessage
  const lines: string[] = []
  const seen: MessageFilePart[] = []
  if (quote) lines.push(quote)
  if (message.text) lines.push(message.text)

  for (const attachment of raw.attachments) {
    if (!FILES.includes(attachment.type)) continue

    const downloaded = await download(attachment.url)
    if (!downloaded.ok) throw new Error(downloaded.error.message)
    const { bytes, contentType } = downloaded.value
    // A document keeps the name it was sent with, in Zernio's payload; other files come without one
    const given = attachment.payload?.filename
    let name = `${attachment.type}.${contentType.split("/")[1]}`
    if (typeof given === "string" && given.trim()) name = given.slice(0, 255)
    const saved = await saveFile(caller, personaId, { name, contentType, bytes })
    if (!saved.ok) throw new Error(saved.error.message)
    const file = saved.value
    const signedUrl = await getFileSignedUrl(caller, file.id)
    if (!signedUrl.ok) throw new Error(signedUrl.error.message)

    let transcript: string | null = null
    if (VOICE.test(contentType)) {
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

// What a reply quotes, so the persona knows which message the person means. Zernio sends only the quoted message's WhatsApp id and has no call for one message, so it is looked for among the conversation's newest 100; one of the person's own messages carries the tag the persona saw on it. A failed lookup is logged, and the message still goes in
async function quoteOf(thread: Thread, message: Message) {
  const raw = message.raw as ZernioRawMessage
  const quotedId = raw.metadata?.quotedMessageId
  if (!quotedId) return null

  const recent = await zernio.fetchMessages(thread.id, { limit: 100 }).catch((error) => {
    console.error("A quoted Zernio message could not be read.", error)
    return null
  })
  const quoted = recent?.messages.find((one) => one.id === quotedId)
  if (!quoted) return "[Replying to an earlier message]"

  const quotedRaw = quoted.raw as ZernioRawMessage
  let whose = "your message"
  if (quotedRaw.direction === "incoming") whose = `their message #${tagOf(quotedId)}`
  if (!quoted.text) return `[Replying to ${whose} (${quoted.attachments[0]?.type ?? "file"})]`

  let shown = quoted.text
  if (shown.length > 300) shown = `${shown.slice(0, 300)}…`
  return `[Replying to ${whose}: "${shown}"]`
}

// ## Chat tools

// One message in WhatsApp's own markers, with its first link's preview. With replyTo, it quotes that message of the person's
export async function reply(thread: Pick<Thread, "id">, markdown: string, replyTo?: string) {
  const message = render(markdown)
  const { accountId, conversationId } = zernio.decodeThreadId(thread.id)

  let quoted: string | null = null
  if (replyTo) quoted = await findMessage(thread.id, replyTo)

  const sent = await sendText(accountId, conversationId, message, quoted)
  if (!sent.ok) throw new Error(sent.error.message)
}

// One of our files goes as real media with its name, by its public link
export async function sendFile(thread: Pick<Thread, "id">, file: { url: string; name: string; contentType: string }) {
  const { accountId, conversationId } = zernio.decodeThreadId(thread.id)
  const sent = await sendAttachment(accountId, conversationId, { url: file.url, name: file.name, kind: kindOf(file.contentType) })
  if (!sent.ok) throw new Error(sent.error.message)
}

// The reaction lands on the tagged message, or on the person's latest. A failed reaction is logged, and the rest of the turn goes on
async function react(thread: Thread, emoji: string, to?: string) {
  let messageId: string | null = null
  if (to) messageId = await findMessage(thread.id, to)
  if (!to) messageId = await bot.getState().get<string>(`message:${thread.id}:latest`)
  if (!messageId) return

  await zernio.addReaction(thread.id, messageId, emoji).catch((error) => console.error("A Zernio reaction failed.", error))
}

// One pass from markdown to WhatsApp's own markers, by WhatsappText. What WhatsApp lacks goes back to text first: a heading turns bold, a table turns monospace, a picture is its link, and a mail or phone link is its bare address, which the converter would otherwise print as "address (mailto:address)"
export function render(markdown: string) {
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

// The person's phone, which the link keeps, since its externalId is Zernio's conversation id: Zernio's sender.phoneNumber, or the sender id when it is the phone's digits. A person with only a WhatsApp user id (BSUID) has none
function phoneOf(message: Message) {
  const raw = message.raw as ZernioRawMessage
  if (raw.sender.phoneNumber) return `+${raw.sender.phoneNumber.replace(/\D/g, "")}`
  if (/^\d+$/.test(raw.sender.id)) return `+${raw.sender.id}`
  return null
}

function kindOf(contentType = "") {
  if (contentType === "image/jpeg" || contentType === "image/png") return "image"
  if (contentType.startsWith("video/")) return "video"
  if (contentType.startsWith("audio/")) return "audio"
  return "file"
}

bot.onDirectMessage(onMessage)

export default channel
