import { activeTurn, call, deliveries, turns, type SessionView } from "eve/events"
import type { EveMessage, UseEveAgentReturn } from "eve/react"

import type { FileDetail } from "@/hooks/files"

type Agent = Pick<UseEveAgentReturn, "messages" | "view" | "status">
type Side = "me" | "them"

export type ChatItem = { key: string; at?: Date; tag?: string; text?: string; quote?: string; file?: { url: string; name?: string; mediaType?: string; size?: number }; fileId?: string; reactions: string[] }

export type ChatRow = { kind: "time"; key: string; at: Date } | { kind: "run"; key: string; side: Side; items: ChatItem[]; receipt?: string } | { kind: "typing"; key: string }

// A time label goes over a message that comes this long after the one before it
const GAP_MS = 15 * 60 * 1000

// Each of your messages starts with a tag, as on WhatsApp and Telegram, so the persona can point at it with chat_react's `to` and chat_say's `replyTo`. A reply names the message it answers by its quoted start
const TAG = /^\[#([0-9a-f]+)\] ?/
const REPLY = /^\[Replying to "([^"]*)"\] ?/

// Until eve accepts a message, its stand-in is one text naming each file as "[file: name]"; the chat shows the file just sent under that name instead
const FILE_NOTE = /\[file(?:: (.+?))?\]/g

// A link to our storage ends in the file id, so an upload of yours is drawn by id, with a fresh link each time; a link eve stored for a data URL is not ours
function fileIdOf(url: string) {
  const id = url.startsWith("http") ? new URL(url).pathname.split("/").filter(Boolean).at(-1) : undefined
  return id
}

// What eve gets for a message of yours: the tag, the quote it replies to, then the text. A message of files alone goes without
export function outgoing(text: string, reply?: ChatItem) {
  if (!text && !reply) return ""
  const quoted = reply ? ` [Replying to "${quoteOf(reply)}"]` : ""
  const said = `[#${newTag()}]${quoted} ${text}`.trim()
  return said
}

// The start of a message as a quote: one line of plain text, at most 80 characters, with no double quote to end it early
export function quoteOf(item: ChatItem) {
  const text = (item.text ?? item.file?.name ?? "a file").replace(/[*`]/g, "").replace(/\s+/g, " ").replaceAll('"', "'").trim()
  if (text.length <= 80) return text
  return `${text.slice(0, 79)}…`
}

function newTag() {
  const tag = crypto.randomUUID().slice(0, 6)
  return tag
}

// The chat as iMessage lays it out: runs of bubbles from one side, a time label after a gap, a receipt under your last message, and dots while the persona writes.
// A message of yours shows the moment it is sent, files first. The persona speaks only through the chat tools, so its text, reasoning and other tools stay out
export function chatRows(agent: Agent, sent: readonly FileDetail[]): ChatRow[] {
  const times = turnTimes(agent.view)
  const rows: ChatRow[] = []
  const tagged = new Map<string, ChatItem>()
  let previous: Date | undefined
  let lastMine: ChatItem | undefined

  function run(side: Side, key: string, at: Date | undefined) {
    const gap = at && (!previous || at.getTime() - previous.getTime() > GAP_MS)
    if (at) previous = at
    if (gap) rows.push({ kind: "time", key: `time:${key}`, at })

    const last = rows.at(-1)
    if (last?.kind === "run" && last.side === side) return last
    const opened: ChatRow = { kind: "run", key, side, items: [] }
    rows.push(opened)
    return opened
  }

  for (const message of agent.messages) {
    const turn = message.metadata?.turnId ? times.get(message.metadata.turnId) : undefined

    if (message.role === "user") {
      const at = turn?.user ?? (message.metadata?.optimistic ? new Date() : undefined)
      const mine = run("me", message.id, at)
      for (const [index, part] of message.parts.entries()) {
        if (part.type === "file" && part.url) mine.items.push({ key: `${message.id}:${index}`, fileId: fileIdOf(part.url), file: { url: part.url, name: part.filename, mediaType: part.mediaType, size: part.size }, reactions: [] })
      }
      for (const [index, part] of message.parts.entries()) {
        if (part.type !== "text") continue
        const notes = message.metadata?.optimistic ? [...part.text.matchAll(FILE_NOTE)] : []
        for (const note of notes) {
          const named = note[1] ?? ""
          const file = sent.findLast((candidate) => named === candidate.name || named.startsWith(`${candidate.name} (`))
          if (file) mine.items.push({ key: `${message.id}:${file.id}`, file: { url: file.url, name: file.name, mediaType: file.contentType, size: file.size }, reactions: [] })
        }
        const tag = TAG.exec(part.text)?.[1]
        const body = part.text.replace(TAG, "")
        const quote = REPLY.exec(body)?.[1]
        const said = body.replace(REPLY, "")
        const text = (notes.length > 0 ? said.replace(FILE_NOTE, "") : said).trim()
        if (!text) continue
        const item: ChatItem = { key: `${message.id}:text:${index}`, at, tag, text, quote, reactions: [] }
        mine.items.push(item)
        if (tag) tagged.set(tag, item)
        lastMine = item
      }
      continue
    }

    for (const part of message.parts) {
      if (part.type !== "tool" || part.state === "streaming") continue
      const input = (part.input ?? {}) as Record<string, unknown>
      const started = call(agent.view, part.callId)?.startedAt
      const at = started ? new Date(started) : turn?.started
      if (part.name === "chat_say" && typeof input.text === "string") {
        const replied = typeof input.replyTo === "string" ? tagged.get(input.replyTo.replace(/^#/, "")) : undefined
        run("them", part.callId, at).items.push({ key: part.callId, at, text: input.text, quote: replied && quoteOf(replied), reactions: [] })
      }
      if (part.name === "chat_file" && typeof input.fileId === "string") run("them", part.callId, at).items.push({ key: part.callId, at, fileId: input.fileId, reactions: [] })
      if (part.name === "chat_react" && typeof input.emoji === "string") {
        const target = typeof input.to === "string" ? tagged.get(input.to.replace(/^#/, "")) : lastMine
        target?.reactions.push(input.emoji)
      }
    }
  }

  // "Read" shows when the persona picks your message up, the turn's start, and the dots once it works on it, as WhatsApp marks a message read on arrival and types while it works
  const busy = agent.status === "busy"
  const last = rows.at(-1)
  const open = activeTurn(agent.view)
  const current = open ? times.get(open.turnId) : undefined
  if (busy && last?.kind === "run" && last.side === "me") last.receipt = current?.started ? `Read ${clock(current.started)}` : "Delivered"
  if (busy && current?.started && !spokeLast(agent.messages)) rows.push({ kind: "typing", key: "typing" })

  return rows
}

const CHAT_TOOLS = new Set(["chat_say", "chat_file", "chat_react"])

// After the persona's latest message the dots wait for its next tool call, as WhatsApp drops typing when a message arrives: the step after a reply often only writes a closing line nobody sees
function spokeLast(messages: readonly EveMessage[]) {
  const last = messages.at(-1)
  if (last?.role !== "assistant") return false

  const parts = [...last.parts].reverse()
  const latest = parts.find((part) => part.type === "tool")
  if (latest?.type !== "tool") return false
  return CHAT_TOOLS.has(latest.name) && latest.state !== "streaming"
}

// When each turn's first message arrived and when the turn started, from the session's own record
function turnTimes(view: SessionView) {
  const times = new Map<string, { user?: Date; started?: Date }>()
  for (const delivery of deliveries(view)) {
    const known = delivery.turnId ? times.get(delivery.turnId) : undefined
    if (!delivery.turnId || !delivery.startedAt || known?.user) continue
    times.set(delivery.turnId, { ...known, user: new Date(delivery.startedAt) })
  }
  for (const turn of turns(view)) {
    if (!turn.startedAt) continue
    times.set(turn.turnId, { ...times.get(turn.turnId), started: new Date(turn.startedAt) })
  }
  return times
}

export function clock(at: Date) {
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return time
}

// "Today", "Yesterday", the weekday within a week, then the date, as Messages labels a day
export function dayOf(at: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - day.getTime()) / 86_400_000)

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return at.toLocaleDateString([], { weekday: "long" })
  return at.toLocaleDateString([], { month: "short", day: "numeric" })
}
