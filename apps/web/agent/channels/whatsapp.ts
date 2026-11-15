import { createRedisState } from "@chat-adapter/state-redis"
import { createKapsoAdapter, KapsoFormatConverter } from "@kapso/chat-adapter"
import { WhatsAppClient } from "@kapso/whatsapp-cloud-api"
import { codeBlock, paragraph, parseMarkdown, strong, tableToAscii, walkAst, type Attachment, type Message, type Thread } from "chat"
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
import { clearChat, resetChat } from "@/usecases/sessions"

// WhatsApp through Kapso: one adapter serves every number of ours, and a chat is one person with one persona. A message from the person links the chat, starts it over, or goes to the persona with a tag it can point at. The persona answers only through the chat tools, which this channel carries out

type Address = { channel: "whatsapp"; line: string; externalId: string }

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

// The Cloud API client for the two calls the adapter cannot make: a text with link previews or a quote, and typing. The adapter keeps its own client, on an older version of the same SDK.
// Both refuse to load with no key, and Kapso is legacy: a setup without it gets "none", and only a Kapso chat would use the key
const client = new WhatsAppClient({ baseUrl: "https://api.kapso.ai/meta/whatsapp", kapsoApiKey: process.env.KAPSO_API_KEY || "none" })
const kapso = createKapsoAdapter({ phoneNumberId: "", userName: "persona", kapsoApiKey: process.env.KAPSO_API_KEY || "none" })
const converter = new KapsoFormatConverter()

export const events: ChatSdkChannelEvents<{ kapso: typeof kapso }> = {
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
    await typing(ctx.channel.thread.id)
  },
  async "call.requested"(_event, ctx) {
    if (!ctx.channel.thread) return
    await bot.initialize()
    await typing(ctx.channel.thread.id)
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
  adapters: { kapso },
  routes: { kapso: "/eve/v1/whatsapp/:phoneNumberId" },
  state: createRedisState({ keyPrefix: "chat:whatsapp" }),
  concurrency: "concurrent",
  streaming: false,
  logger: "warn",
  events,
})

export function encodeThreadId(phoneNumberId: string, waId: string, personaId: string) {
  const id = kapso.encodeThreadId({ phoneNumberId, waId, conversationId: personaId })
  return id
}

// The person on a chat, as the agent sees them: the reports act as them too, so a session at their thread is always theirs
export function encodePrincipal(orgId: string, link: { id: string; personaId: string; line: string; externalId: string }) {
  const caller: Caller = { orgId, userId: `whatsapp:${link.line}:${link.externalId}` }
  const auth = toPrincipal({ ...caller, personaId: link.personaId, linkId: link.id, channel: "whatsapp" })
  return { caller, auth }
}

// ## Incoming

async function onMessage(thread: Thread, message: Message) {
  try {
    await thread.startTyping().catch(() => undefined)
    const answer = await receive(thread, message)
    if (answer) await reply(thread, answer)
  } catch (error) {
    console.error("A WhatsApp message failed.", error)
    await reply(thread, REPLIES.failed)
  }
}

// Returns what to answer the person, or null once the persona has the message
async function receive(thread: Thread, message: Message): Promise<string | null> {
  const { phoneNumberId, waId } = kapso.decodeThreadId(thread.id)
  const address: Address = { channel: "whatsapp", line: phoneNumberId, externalId: waId }
  const text = message.text.trim()

  const code = LINK_CODE.exec(text)?.[1]
  if (code) {
    const redeemed = await redeemLinkCode({ ...address, code, label: message.author.fullName })
    if (!redeemed.ok) return redeemed.error.message
    const answer = `You're connected to ${redeemed.value.personaName}. Say hi!`
    return answer
  }

  const linked = await findLinkedPersona(address)
  if (!linked.ok) throw new Error(linked.error.message)
  if (!linked.value) return REPLIES.stranger
  const { persona } = linked.value

  const { caller, auth } = encodePrincipal(persona.orgId, linked.value)
  const threadId = encodeThreadId(phoneNumberId, waId, persona.id)
  const chat = `whatsapp:${threadId}`

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

  // WhatsApp's own message ids are long, so the tag the persona sees is a short hash of one
  const tag = createHash("sha256").update(message.id).digest("hex").slice(0, 6)
  const content = await contentOf(caller, persona.id, message, tag)
  if (!content) return REPLIES.unreadable

  // The platform's id of the message, kept a week under its tag and as the latest, for the chat tools to react or reply to
  const state = bot.getState()
  await state.set(`message:${threadId}:${tag}`, message.id, WEEK_MS)
  await state.set(`message:${threadId}:latest`, message.id, WEEK_MS)

  const target = { ...thread.toJSON(), id: threadId, channelId: kapso.channelIdFromThreadId(threadId) }
  // The platform message id is the delivery key: a webhook retried after eve accepted the message runs no second turn, and one retried before it still gets in
  await send(content, { thread: target, auth, idempotencyKey: message.id })
  return null
}

// What the persona reads: the tag, the text, and each attachment saved to the persona's files, as Kapso's transcript for a voice note and as a file the model can see for a picture or a PDF
async function contentOf(caller: Caller, personaId: string, message: Message, tag: string): Promise<MessageContent | null> {
  const raw = message.raw as { kapso?: { transcript?: { text?: string } } } | null
  const transcript = raw?.kapso?.transcript?.text
  const lines: string[] = []
  const seen: MessageFilePart[] = []
  if (message.text) lines.push(message.text)

  for (const attachment of message.attachments) {
    if (!attachment.fetchData) continue

    const data = await attachment.fetchData()
    const contentType = attachment.mimeType?.split(";")[0]?.trim() || "application/octet-stream"
    const name = attachment.name ?? `${attachment.type}.${contentType.split("/")[1]}`
    const saved = await saveFile(caller, personaId, { name, contentType, bytes: new Uint8Array(data) })
    if (!saved.ok) throw new Error(saved.error.message)
    const file = saved.value
    const signedUrl = await getFileSignedUrl(caller, file.id)
    if (!signedUrl.ok) throw new Error(signedUrl.error.message)

    const heard = transcript !== undefined && VOICE.test(contentType)
    if (heard) lines.push(`[Voice note, file id ${file.id}] ${transcript}`)
    if (!heard) lines.push(`[Sent ${file.name} (${contentType}), file id ${file.id}]`)
    if (SEEN.includes(contentType)) seen.push({ type: "file", data: new URL(signedUrl.value), mediaType: contentType, filename: file.name })
  }

  if (lines.length === 0) return null

  const text = `[#${tag}] ${lines.join("\n")}`
  if (seen.length === 0) return text
  const content: MessageContent = [{ type: "text", text }, ...seen]
  return content
}

// ## Chat tools

// One message in WhatsApp's own markers, with its links' previews on. With replyTo, it quotes that message of the person's
export async function reply(thread: Pick<Thread, "id">, markdown: string, replyTo?: string) {
  const text = render(markdown)
  const { phoneNumberId, waId } = kapso.decodeThreadId(thread.id)

  let quoted: string | null = null
  if (replyTo) quoted = await findMessage(thread.id, replyTo)

  await client.messages.sendText({ phoneNumberId, to: waId, body: text, previewUrl: true, contextMessageId: quoted ?? undefined })
}

// One of our files goes as real media with its name and type
export async function sendFile(thread: Pick<Thread, "post">, file: { url: string; name: string; contentType: string }) {
  await thread.post({ raw: "", attachments: [{ type: kindOf(file.contentType), url: file.url, name: file.name, mimeType: file.contentType }] })
}

// The reaction lands on the tagged message, or on the person's latest. A failed reaction is logged, and the rest of the turn goes on
async function react(thread: Thread, emoji: string, to?: string) {
  let messageId: string | null = null
  if (to) messageId = await findMessage(thread.id, to)
  if (!to) messageId = await bot.getState().get<string>(`message:${thread.id}:latest`)
  if (!messageId) return

  await kapso.addReaction(thread.id, messageId, emoji).catch((error) => console.error("A WhatsApp reaction failed.", error))
}

// Typing on the person's latest message, which comes from the state store: Kapso's own startTyping finds it only in the memory of the function that took the webhook, and the chat tools run in a workflow step that never did. Typing also marks the message read. A failed typing is logged, and the turn goes on
async function typing(threadId: string) {
  const messageId = await bot.getState().get<string>(`message:${threadId}:latest`)
  if (!messageId) return

  const { phoneNumberId } = kapso.decodeThreadId(threadId)
  await client.messages.markRead({ phoneNumberId, messageId, typingIndicator: { type: "text" } }).catch((error) => console.error("WhatsApp typing failed.", error))
}

// One pass from markdown to WhatsApp's own markers, by the adapter's converter. What WhatsApp lacks goes back to text first: a heading turns bold, a table turns monospace, a picture is its link, and a mail or phone link is its bare address, which the converter would otherwise print as "address (mailto:address)"
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

async function findMessage(threadId: string, tag: string) {
  const messageId = await bot.getState().get<string>(`message:${threadId}:${tag.replace(/^#/, "")}`)
  return messageId
}

// ## Helpers

function kindOf(contentType = ""): Attachment["type"] {
  if (contentType === "image/jpeg" || contentType === "image/png") return "image"
  if (contentType.startsWith("video/")) return "video"
  if (contentType.startsWith("audio/")) return "audio"
  return "file"
}

bot.onDirectMessage(onMessage)

export default channel
