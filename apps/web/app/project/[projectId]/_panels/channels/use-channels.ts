"use client"

import { useLinks, type Link } from "@/hooks/links"
import type { Persona } from "@/hooks/personas"
import { useTelegramBots, type SharedTelegramBot, type TelegramBot } from "@/hooks/telegram"
import { useMetaLines, type MetaLine, type SharedMetaNumber } from "@/hooks/whatsapp-meta"
import { LINK_CODE_HOURS } from "@/lib/link-codes"

// The channels the app offers numbers and bots on. Chats on the legacy number (Kapso's) stay, but the app no longer shows that number
export type Channel = "whatsapp_meta" | "telegram"

// A number or a bot people write to: Persona's shared one, or one of the project's own. address is what a link keeps as its line; handle builds the chat link.
export type Line = { id: string; channel: Channel; label: string; address: string; handle: string; shared: boolean }

// A linked chat, with the name to show and the number or bot it writes to (null on a legacy number)
export type Chat = Link & { name: string; lineLabel: string | null }

// The Channels page's data: every number and bot (WhatsApp on Meta, then Telegram, each with the shared one first), and the persona's chats
export function useChannels(persona: Persona) {
  const meta = useMetaLines(persona.projectId)
  const telegram = useTelegramBots(persona.projectId)
  const { links, error: linksError } = useLinks(persona.id)
  const lines: Line[] = []
  if (meta.lines) lines.push(...whatsappLines(meta.shared, meta.lines))
  lines.push(...telegramLines(telegram.shared, telegram.bots))
  const chats = links?.map((link) => toChat(link, lines))
  return { lines, chats, linesError: meta.error ?? telegram.error, linesLoading: meta.isLoading || telegram.isLoading, linksError }
}

// The link that opens the chat with the code ready: WhatsApp with "link <code>" typed in, the Telegram bot with Start. Null when the number or bot has no public handle.
export function chatUrl(line: Line, code: string) {
  if (line.channel === "whatsapp_meta") { return whatsappUrl(line.handle, code) }
  if (line.channel === "telegram") { return telegramUrl(line.handle, code) }

  throw new Error(`Unknown channel: ${line.channel}`)
}

// WhatsApp on the number, with "link <code>" typed in. Null when the number has no digits
function whatsappUrl(number: string, code: string) {
  const digits = number.replace(/\D/g, "")
  if (!digits) return null
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(`link ${code}`)}`
  return url
}

// The bot's chat, where Start sends the code. Null when the bot has no username
function telegramUrl(username: string, code: string) {
  if (!username) return null
  const url = `https://t.me/${username}?start=${code}`
  return url
}

// What the person sends by hand
export function codeMessage(line: Line, code: string) {
  if (line.channel === "whatsapp_meta") { return `link ${code}` }
  if (line.channel === "telegram") { return `/link ${code}` }

  throw new Error(`Unknown channel: ${line.channel}`)
}

// The invite to paste in an email or chat: the chat link when there is one, else the code to send by hand.
export function inviteMessage(line: Line, code: string) {
  const url = chatUrl(line, code)
  const invite = url ? `Here's your invitation to Persona: ${url}` : `Here's your invitation to Persona: send "${codeMessage(line, code)}" to ${line.label}`
  const message = `${invite}\nThis invite is just for you and expires in ${LINK_CODE_HOURS} hours.`
  return message
}

// Persona's shared number on Meta, when this environment has one, then the project's own numbers on the customers' own Meta apps. A link reaches each on whatsapp_meta, by its phone number id
function whatsappLines(shared: SharedMetaNumber | undefined, own: MetaLine[]): Line[] {
  const sharedLine: Line[] = shared ? [{ id: "shared-whatsapp_meta", channel: "whatsapp_meta", label: shared.number || shared.phoneNumberId, address: shared.phoneNumberId, handle: shared.number, shared: true }] : []
  const ownLines: Line[] = own.map((line) => ({ id: line.id, channel: "whatsapp_meta", label: line.number, address: line.phoneNumberId, handle: line.number, shared: false }))
  return [...sharedLine, ...ownLines]
}

function telegramLines(shared: SharedTelegramBot | null | undefined, own: TelegramBot[] | undefined): Line[] {
  const sharedBot = shared ? [{ id: "shared-telegram", channel: "telegram" as const, label: shared.username ? `@${shared.username}` : shared.name || shared.botId, address: shared.botId, handle: shared.username, shared: true }] : []
  const ownBots = (own ?? []).map((bot) => ({ id: bot.id, channel: "telegram" as const, label: `@${bot.username}`, address: bot.botId, handle: bot.username, shared: false }))
  return [...sharedBot, ...ownBots]
}

function toChat(link: Link, lines: Line[]): Chat {
  const line = lines.find((item) => item.channel === link.channel && item.address === link.line)
  const names = { whatsapp: `+${link.externalId}`, whatsapp_meta: link.phone ?? "WhatsApp chat", telegram: "Telegram chat" }
  const name = link.label ?? names[link.channel]
  const chat = { ...link, name, lineLabel: line?.label ?? null }
  return chat
}
