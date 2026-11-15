import { createRedisState } from "@chat-adapter/state-redis"
import { TelegramAdapter, type TelegramThreadId } from "@chat-adapter/telegram"
import type { AdapterPostableMessage, Attachment, ChatInstance, EmojiValue, Message, Postable, SlashCommandEvent, Thread, WebhookOptions } from "chat"
import type { MessageContent, MessageFilePart } from "eve/channels"
import { chatSdkChannel, type ChatSdkChannelEvents } from "eve/channels/chat-sdk"
import { call } from "eve/events"
import { toolResultFrom } from "eve/tools"

import chatFile from "@/agent/tools/chat_file"
import chatReact from "@/agent/tools/chat_react"
import chatSay from "@/agent/tools/chat_say"
import { toPrincipal } from "@/usecases/agent"
import type { Caller } from "@/usecases/auth"
import { getFileSignedUrl, saveFile } from "@/usecases/files"
import { findLinkedPersona, redeemLinkCode } from "@/usecases/links"
import { transcribeAudio } from "@/usecases/media"
import { clearChat, resetChat } from "@/usecases/sessions"
import { readTelegramToken } from "@/usecases/telegram"

// Telegram: one router adapter opens the right bot from the webhook path, with that bot's own token. /start and /link link a chat, /clear and /reset start it over, and any other message goes to the persona with a tag it can point at. The persona answers only through the chat tools, which this channel carries out

type BotThread = TelegramThreadId & { botId: string; personaId?: string }
type Address = { channel: "telegram"; line: string; externalId: string }

const REPLIES = {
  stranger: "Hi! This chat isn't connected to a persona yet. Open your link again, or send your code like this: /link 1a2b3c4d",
  unreadable: "I can't read that kind of message yet. Send text, a photo, a voice note or a file.",
  failed: "Something went wrong on my side. Try again in a moment. If it keeps happening, send /clear to clear our chat or /reset to start a new one.",
  cleared: "Cleared our chat.",
  reset: "Started a new chat.",
}

const VOICE = /^audio\/(ogg|opus)/
const SEEN = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]
const WEEK_MS = 7 * 24 * 60 * 60_000

class TelegramBots extends TelegramAdapter {
  constructor() {
    super({ botToken: () => { throw new Error("Telegram calls go through each bot's own adapter.") } })
  }

  async initialize(chat: ChatInstance) {
    this.chat = chat
  }

  async handleWebhook(request: Request, options?: WebhookOptions) {
    const bot = await this.open(new URL(request.url).pathname.split("/").at(-1) ?? "")
    await bot.initialize(this.chat!)
    const response = await bot.handleWebhook(request, { ...options, deduplicate: false })
    return response
  }

  async postMessage(threadId: string, message: AdapterPostableMessage, replyTo?: string) {
    const { botId, chatId } = this.decodeThreadId(threadId)
    const bot = await this.open(botId)
    const sent = await bot.postMessage(`telegram:${chatId}`, message, replyTo)
    return sent
  }

  async startTyping(threadId: string) {
    const { botId, chatId } = this.decodeThreadId(threadId)
    const bot = await this.open(botId)
    await bot.startTyping(`telegram:${chatId}`)
  }

  async addReaction(threadId: string, messageId: string, emoji: EmojiValue | string) {
    const { botId, chatId } = this.decodeThreadId(threadId)
    const bot = await this.open(botId)
    await bot.addReaction(`telegram:${chatId}`, messageId, emoji)
  }

  encodeThreadId(thread: TelegramThreadId & Partial<BotThread>) {
    const id = ["telegram", thread.botId, thread.chatId, thread.personaId].filter(Boolean).join(":")
    return id
  }

  decodeThreadId(threadId: string): BotThread {
    const [, botId = "", chatId = "", personaId] = threadId.split(":")
    const thread = { botId, chatId, personaId }
    return thread
  }

  channelIdFromThreadId(threadId: string) {
    const { botId, chatId } = this.decodeThreadId(threadId)
    const id = this.encodeThreadId({ botId, chatId })
    return id
  }

  private async open(botId: string) {
    const token = await readTelegramToken(botId)
    if (!token.ok) throw new Error(token.error.message)

    const bot = new TelegramAdapter({ botToken: token.value, secretToken: process.env.TELEGRAM_WEBHOOK_SECRET, userName: "persona", mode: "webhook" })
    Object.assign(bot, { richMessagesAvailable: false })
    return bot
  }
}

export const telegram = new TelegramBots()

export const events: ChatSdkChannelEvents<{ telegram: typeof telegram }> = {
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
    await ctx.channel.thread.startTyping().catch(() => undefined)
  },
  async "call.requested"(_event, ctx) { // Typing shows the moment the model asks for a call, before the calls' results send the step's messages, which end it
    if (!ctx.channel.thread) return
    await bot.initialize() // On Vercel this runs in a workflow step, a function that never took a webhook, so the Chat SDK has not connected its state store there yet; initialize connects it once and then does nothing
    await ctx.channel.thread.startTyping().catch(() => undefined)
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
  adapters: { telegram },
  routes: { telegram: "/eve/v1/telegram/:botId" },
  state: createRedisState({ keyPrefix: "chat:telegram" }),
  concurrency: "concurrent",
  streaming: false,
  logger: "warn",
  events,
})

export function encodeThreadId(botId: string, chatId: string, personaId: string) {
  const id = telegram.encodeThreadId({ botId, chatId, personaId })
  return id
}

// The person on a chat, as the agent sees them: the reports act as them too, so a session at their thread is always theirs
export function encodePrincipal(orgId: string, link: { id: string; personaId: string; line: string; externalId: string }) {
  const caller: Caller = { orgId, userId: `telegram:${link.line}:${link.externalId}` }
  const auth = toPrincipal({ ...caller, personaId: link.personaId, linkId: link.id, channel: "telegram" })
  return { caller, auth }
}

// ## Incoming

async function onMessage(thread: Thread, message: Message) {
  try {
    const answer = await receive(thread, message)
    if (answer) await reply(thread, answer)
  } catch (error) {
    console.error("A Telegram message failed.", error)
    await reply(thread, REPLIES.failed)
  }
}

// /start with a code links the chat, /start alone says hello, and /link links the chat
async function onLinkCommand(event: SlashCommandEvent) {
  try {
    const address = addressOf(event.channel)
    const code = event.text.trim()
    let answer = ""
    if (code) {
      const redeemed = await redeemLinkCode({ ...address, code, label: event.user.fullName })
      if (!redeemed.ok) answer = redeemed.error.message
      if (redeemed.ok) answer = `You're connected to ${redeemed.value.personaName}. Say hi!`
    }
    if (!code) {
      const linked = await findLinkedPersona(address)
      if (!linked.ok) throw new Error(linked.error.message)
      if (!linked.value) answer = REPLIES.stranger
      if (linked.value) answer = `You're connected to ${linked.value.persona.name}. Say hi!`
    }
    await event.channel.post(answer)
  } catch (error) {
    console.error("A Telegram command failed.", error)
    await event.channel.post(REPLIES.failed)
  }
}

async function onChatCommand(event: SlashCommandEvent) {
  try {
    const address = addressOf(event.channel)
    const linked = await findLinkedPersona(address)
    if (!linked.ok) throw new Error(linked.error.message)
    if (!linked.value) { await event.channel.post(REPLIES.stranger); return }
    const { persona } = linked.value

    const { caller } = encodePrincipal(persona.orgId, linked.value)
    const chat = `telegram:${encodeThreadId(address.line, address.externalId, persona.id)}`

    if (event.command === "/clear") {
      const cleared = await clearChat(caller, chat)
      if (!cleared.ok) throw new Error(cleared.error.message)
      await event.channel.post(REPLIES.cleared)
      return
    }
    if (event.command === "/reset") {
      const reset = await resetChat(caller, chat)
      if (!reset.ok) throw new Error(reset.error.message)
      await event.channel.post(REPLIES.reset)
      return
    }

    throw new Error("Unknown command.")
  } catch (error) {
    console.error("A Telegram command failed.", error)
    await event.channel.post(REPLIES.failed)
  }
}

// Returns what to answer the person, or null once the persona has the message
async function receive(thread: Thread, message: Message): Promise<string | null> {
  const address = addressOf(thread)
  const linked = await findLinkedPersona(address)
  if (!linked.ok) throw new Error(linked.error.message)
  if (!linked.value) return REPLIES.stranger
  const { persona } = linked.value

  const { caller, auth } = encodePrincipal(persona.orgId, linked.value)
  const threadId = encodeThreadId(address.line, address.externalId, persona.id)
  // The adapter's message id is "<chat>:<message number>", and the tag the persona sees is the number
  const tag = message.id.split(":").at(-1) ?? message.id
  const content = await contentOf(caller, persona.id, message, tag)
  if (!content) return REPLIES.unreadable

  // The platform's id of the message, kept a week under its tag and as the latest, for the chat tools to react or reply to
  const state = bot.getState()
  await state.set(`message:${threadId}:${tag}`, message.id, WEEK_MS)
  await state.set(`message:${threadId}:latest`, message.id, WEEK_MS)

  const target = { ...thread.toJSON(), id: threadId, channelId: telegram.channelIdFromThreadId(threadId) }
  // The platform message id is the delivery key: a webhook retried after eve accepted the message runs no second turn, and one retried before it still gets in
  await send(content, { thread: target, auth, idempotencyKey: message.id })
  return null
}

// What the persona reads: the tag, the text, and each attachment saved to the persona's files, as our own transcript for a voice note and as a file the model can see for a picture or a PDF
async function contentOf(caller: Caller, personaId: string, message: Message, tag: string): Promise<MessageContent | null> {
  const lines: string[] = []
  const seen: MessageFilePart[] = []
  if (message.text) lines.push(message.text)

  for (const attachment of message.attachments) {
    if (!attachment.fetchData) continue

    const data = await attachment.fetchData()
    const bytes = new Uint8Array(data)
    const contentType = attachment.mimeType?.split(";")[0]?.trim() || "application/octet-stream"
    const name = attachment.name ?? `${attachment.type}.${contentType.split("/")[1]}`
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

  const text = `[#${tag}] ${lines.join("\n")}`
  if (seen.length === 0) return text
  const content: MessageContent = [{ type: "text", text }, ...seen]
  return content
}

// ## Chat tools

// One message as written, since Telegram renders markdown itself. With replyTo, it quotes that message of the person's
export async function reply(thread: Pick<Thread, "id" | "post">, markdown: string, replyTo?: string) {
  let quoted: string | null = null
  if (replyTo) quoted = await findMessage(thread.id, replyTo)

  if (quoted) await telegram.postMessage(thread.id, { markdown }, quoted)
  if (!quoted) await thread.post({ markdown })
}

// One of our files goes as real media with its name and type
export async function sendFile(thread: Pick<Thread, "post">, file: { url: string; name: string; contentType: string }) {
  await thread.post({ raw: "", attachments: [{ type: kindOf(file.contentType), url: file.url, name: file.name, mimeType: file.contentType, fetchData: () => download(file.url) }] })
}

// The reaction lands on the tagged message, or on the person's latest. A failed reaction is logged, and the rest of the turn goes on
async function react(thread: Thread, emoji: string, to?: string) {
  let messageId: string | null = null
  if (to) messageId = await findMessage(thread.id, to)
  if (!to) messageId = await bot.getState().get<string>(`message:${thread.id}:latest`)
  if (!messageId) return

  await telegram.addReaction(thread.id, messageId, emoji).catch((error) => console.error("A Telegram reaction failed.", error))
}

// ## Message tags

async function findMessage(threadId: string, tag: string) {
  const messageId = await bot.getState().get<string>(`message:${threadId}:${tag.replace(/^#/, "")}`)
  return messageId
}

// ## Helpers

// Telegram fetches a document from a link only when it is a PDF or a ZIP, so the channel uploads the bytes itself
async function download(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download ${url} (${response.status}).`)

  const data = await response.arrayBuffer()
  return data
}

function addressOf(chat: Postable): Address {
  const [, chatId = ""] = chat.id.split(":")
  const address: Address = { channel: "telegram", line: chat.adapter.botUserId ?? "", externalId: chatId }
  return address
}

function kindOf(contentType = ""): Attachment["type"] {
  if (["image/jpeg", "image/png", "image/webp"].includes(contentType)) return "image"
  if (contentType === "video/mp4") return "video"
  if (contentType === "audio/mpeg" || contentType === "audio/mp4") return "audio"
  return "file"
}

bot.onDirectMessage(onMessage)
bot.onSlashCommand(["/start", "/link"], onLinkCommand)
bot.onSlashCommand(["/clear", "/reset"], onChatCommand)

export default channel
