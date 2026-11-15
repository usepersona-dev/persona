"use client"

import { useUser } from "@clerk/nextjs"
import { turns } from "eve/events"
import { FileIcon, ReplyIcon } from "lucide-react"
import { useState } from "react"
import { Streamdown } from "streamdown"

import { TelegramIcon, WhatsappIcon } from "@/components/icons"
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment"
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "@/components/ui/message-scroller"
import { useFile, type FileDetail } from "@/hooks/files"
import type { Persona } from "@/hooks/personas"
import { cn } from "@/lib/utils"

import { usePanels } from "../../_hooks/use-panels"
import { useChannels } from "../channels/use-channels"
import { ChatComposer } from "./chat-composer"
import { chatRows, clock, dayOf, quoteOf, type ChatItem, type ChatRow } from "./chat-rows"
import { usePersonaChat } from "./use-persona-chat"

type Agent = ReturnType<typeof usePersonaChat>["agent"]
type Reply = (item: ChatItem) => void

// shadcn's bubble is ink for you; the persona's is sand. The last bubble of a run curls a tail out of its bottom corner: a bubble-colored corner with a panel-colored piece cut out of it, so it needs the panel's color behind the chat
const SAND = "*:data-[slot=bubble-content]:bg-accent *:data-[slot=bubble-content]:text-accent-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-accent/80"
const TEXT = "relative z-0 overflow-visible rounded-[18px] border-0 px-3 py-[7px] text-xs leading-normal"
const TAIL = "before:absolute before:bottom-0 before:-z-10 before:h-5 before:w-5 after:absolute after:bottom-0 after:-z-10 after:h-5 after:w-[26px] after:bg-sidebar"
const TAIL_MINE = "before:-right-[7px] before:rounded-bl-[16px_14px] before:bg-primary after:-right-[26px] after:rounded-bl-[10px]"
const TAIL_THEIRS = "before:-left-[7px] before:rounded-br-[16px_14px] before:bg-accent after:-left-[26px] after:rounded-br-[10px]"

// The buttons above the field: each app's logo in its brand color
const APPS = {
  whatsapp_meta: { app: "WhatsApp", Icon: WhatsappIcon, color: "text-[#25D366]" },
  telegram: { app: "Telegram", Icon: TelegramIcon, color: "text-[#229ED9]" },
}

// The Chat tab on shadcn's chat parts, dressed as iMessage in our colors. Hovering a row of the persona's shows Reply beside its message; only the persona reacts, as on WhatsApp and Telegram.
// The column is 36rem wide and the scroller fills the panel, so its bar sits at the panel's edge; the field sits under it, above the dock
export function ChatPage({ persona }: { persona: Persona }) {
  const { agent, busy, send, sent, upload, discard } = usePersonaChat(persona.id)
  const [replying, setReplying] = useState<ChatItem>()
  const rows = chatRows(agent, sent)
  const failure = agent.error?.message ?? turnFailure(agent.view)

  function onSend(text: string, files: FileDetail[]) {
    send(text, files, replying)
    setReplying(undefined)
  }

  function onNewChat() {
    setReplying(undefined)
    agent.newSession()
  }

  const composer = <ChatComposer replying={replying && quoteOf(replying)} onCancelReply={() => setReplying(undefined)} onSend={onSend} onUpload={upload} onDiscard={discard} onNewChat={onNewChat} />

  if (agent.messages.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-[36rem] flex-col justify-center px-4 pt-16 pb-24">
        <Welcome />
        <ChannelButtons persona={persona} />
        {composer}
      </div>
    )
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <div className="flex h-full flex-col">
        <MessageScroller className="ph-no-capture min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-[36rem] gap-3 px-4 pt-16 pb-6">
              {rows.map((row) => (
                <MessageScrollerItem key={row.key} messageId={row.key}>
                  <Row row={row} onReply={setReplying} />
                </MessageScrollerItem>
              ))}
              {failure && !busy && (
                <Marker role="alert" className="justify-center text-[11px] text-destructive">
                  {failure}
                </Marker>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
        <div className="mx-auto w-full max-w-[36rem] px-4 pb-24">
          <ChannelButtons persona={persona} />
          {composer}
        </div>
      </div>
    </MessageScrollerProvider>
  )
}

// A new chat asks one question, with the first name on the account: what to do today, or tonight from 10 PM to 5 AM
function Welcome() {
  const { user } = useUser()
  const hour = new Date().getHours()
  const when = hour >= 22 || hour < 5 ? "tonight" : "today"
  const question = user?.firstName ? `What can we do ${when}, ${user.firstName}?` : `What can we do ${when}?`

  return <p className="mb-7 text-center text-2xl leading-tight font-medium tracking-tight @lg:text-[1.75rem]">{question}</p>
}

// Chat on WhatsApp and Chat on Telegram, centered above the field: each opens the Link panel of Persona's shared number or bot. None while they load, or when this setup has neither
function ChannelButtons({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { lines } = useChannels(persona)
  const shared = lines.filter((line) => line.shared)
  if (shared.length === 0) return null

  return (
    <div className="mb-2.5 flex flex-wrap justify-center gap-2">
      {shared.map((line) => {
        const look = APPS[line.channel]
        return (
          <Button key={line.id} variant="outline" size="sm" onClick={() => panels.openLink(line.id)} className="h-8 rounded-full border-foreground/10 bg-card px-3 text-[13px] shadow-[0_0.125rem_0.75rem_rgb(0_0_0/0.07)] hover:bg-card">
            <look.Icon data-icon="inline-start" className={look.color} />
            Chat on {look.app}
          </Button>
        )
      })}
    </div>
  )
}

function Row({ row, onReply }: { row: ChatRow; onReply: Reply }) {
  if (row.kind === "time") {
    return (
      <Marker className="mt-2 justify-center text-[11px]">
        <MarkerContent>
          <span className="font-semibold">{dayOf(row.at)}</span> {clock(row.at)}
        </MarkerContent>
      </Marker>
    )
  }
  if (row.kind === "typing") return <Typing />

  const mine = row.side === "me"
  return (
    <Message align={mine ? "end" : "start"}>
      <MessageContent className="gap-1">
        <BubbleGroup className="w-full gap-0.5">
          {row.items.map((item, index) => {
            const next = row.items[index + 1]
            const tail = item.text !== undefined && next?.text === undefined
            return <Item key={item.key} item={item} mine={mine} tail={tail} onReply={onReply} />
          })}
        </BubbleGroup>
        {row.receipt && <MessageFooter className="px-1 text-[11px] font-normal">{row.receipt}</MessageFooter>}
      </MessageContent>
    </Message>
  )
}

// One message: a bubble with the message it answers faded above it, or a file. The persona's reaction sits on your message's top corner.
// A row of the persona's fills the width, and hovering anywhere on it shows Reply right after the message; the button keeps its place while hidden, so nothing moves
function Item({ item, mine, tail, onReply }: { item: ChatItem; mine: boolean; tail: boolean; onReply: Reply }) {
  const reacted = item.reactions.length > 0
  const file = item.fileId ? <SentFile fileId={item.fileId} mine={mine} /> : item.file && <Attached url={item.file.url} name={item.file.name} mediaType={item.file.mediaType} size={item.file.size} mine={mine} />
  const message = file ?? (
    <Bubble align={mine ? "end" : "start"} className={cn("max-w-[76%] gap-0.5", !mine && SAND, reacted && "mt-3.5")}>
      {item.quote && (
        <p className={cn("w-fit max-w-full rounded-2xl px-[11px] py-[5px] text-[11px] leading-[1.45] opacity-55", mine ? "self-end bg-accent text-accent-foreground" : "bg-primary text-primary-foreground")}>
          <span className="line-clamp-2">{item.quote}</span>
        </p>
      )}
      <BubbleContent className={cn(TEXT, tail && TAIL, tail && (mine ? TAIL_MINE : TAIL_THEIRS))}>{mine ? <p className="whitespace-pre-wrap">{item.text}</p> : <Streamdown className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{item.text}</Streamdown>}</BubbleContent>
      {reacted && (
        <BubbleReactions side="top" align="start" className="-start-3 h-7 min-w-7 -translate-y-1/2 bg-accent px-1 py-0 text-[13px] leading-none ring-2 ring-sidebar">
          {item.reactions.join("")}
        </BubbleReactions>
      )}
    </Bubble>
  )

  if (mine) return message
  return (
    <div className="group/item flex w-full items-center gap-1">
      {message}
      <Button variant="ghost" size="icon-xs" aria-label="Reply" onClick={() => onReply(item)} className="opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100">
        <ReplyIcon />
      </Button>
    </div>
  )
}

// A file found by its id: one the persona sent with chat_file, or one of yours. The link comes fresh with each fetch
function SentFile({ fileId, mine = false }: { fileId: string; mine?: boolean }) {
  const { file } = useFile(fileId)
  if (!file) return null

  return <Attached url={file.url} name={file.name} mediaType={file.contentType} size={file.size} mine={mine} />
}

// A picture shows itself in a bubble; any other file is an attachment card with its name, type and size, in the sender's color. Either opens the file
function Attached({ url, name, mediaType, size, mine = false }: { url: string; name?: string; mediaType?: string; size?: number; mine?: boolean }) {
  if (mediaType?.startsWith("image/")) {
    return (
      <Bubble align={mine ? "end" : "start"}>
        <BubbleContent render={<a href={url} target="_blank" rel="noreferrer" />} className="rounded-[18px] border-0 p-0">
          <img src={url} alt={name ?? ""} className="max-h-64 w-50 max-w-full object-cover" />
        </BubbleContent>
      </Bubble>
    )
  }

  const kind = name?.split(".").at(-1)?.toUpperCase() ?? "File"
  const details = [kind, size === undefined ? undefined : bytes(size)].filter(Boolean).join(" · ")
  return (
    <Attachment size="sm" className={cn("w-58 rounded-[18px] border-0", mine ? "self-end bg-primary text-primary-foreground has-[>a,>button]:hover:bg-primary/90" : "bg-accent text-accent-foreground has-[>a,>button]:hover:bg-accent/80")}>
      <AttachmentMedia className={mine ? "bg-primary-foreground/15" : "bg-card text-muted-foreground"}>
        <FileIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{name ?? "File"}</AttachmentTitle>
        <AttachmentDescription className="text-current opacity-70">{details}</AttachmentDescription>
      </AttachmentContent>
      <AttachmentTrigger render={<a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${name ?? "the file"}`} />} />
    </Attachment>
  )
}

// The persona is writing: a sand bubble of dots trailing two small circles, as Messages shows it
function Typing() {
  return (
    <Bubble className={SAND}>
      <BubbleContent role="status" aria-label="Typing" className="relative ms-1 flex h-[34px] items-center gap-1 overflow-visible rounded-[18px] border-0 px-[13px] py-0 before:absolute before:-bottom-0.5 before:-left-0.5 before:size-[11px] before:rounded-full before:bg-accent after:absolute after:-bottom-[7px] after:-left-[7px] after:size-[5px] after:rounded-full after:bg-accent">
        <span className="size-[7px] animate-pulse rounded-full bg-foreground/35" />
        <span className="size-[7px] animate-pulse rounded-full bg-foreground/35 [animation-delay:150ms]" />
        <span className="size-[7px] animate-pulse rounded-full bg-foreground/35 [animation-delay:300ms]" />
      </BubbleContent>
    </Bubble>
  )
}

function bytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

// The latest turn's failure, until a new message starts the next turn. A model outage gets plain words, as in eve's own template
function turnFailure(view: Agent["view"]) {
  const latest = turns(view).at(-1)
  if (latest?.outcome !== "failed") return undefined
  return latest.error?.code === "MODEL_CALL_FAILED" ? "The model is not answering right now. Try again." : latest.error?.message
}
