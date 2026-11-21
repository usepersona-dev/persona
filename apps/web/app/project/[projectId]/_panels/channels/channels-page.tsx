"use client"

import { format, isThisYear, isToday } from "date-fns"
import { ChevronRightIcon, CloudOffIcon, EllipsisIcon, SettingsIcon } from "lucide-react"
import { useState } from "react"

import { DiscordAppIcon, ImessageAppIcon, SlackAppIcon, TelegramAppIcon, WhatsappAppIcon } from "@/components/icons"
import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton, ScreenSection, ScreenSectionCount, ScreenSectionTitle } from "@/components/screen"
import { Section, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useUnlink } from "@/hooks/links"
import type { Persona } from "@/hooks/personas"

import { usePanels } from "../../_hooks/use-panels"
import { useChannels, type Chat, type Line } from "./use-channels"

const BRAND = {
  whatsapp: { name: "WhatsApp (Legacy)", Icon: WhatsappAppIcon },
  whatsapp_meta: { name: "WhatsApp", Icon: WhatsappAppIcon },
  telegram: { name: "Telegram", Icon: TelegramAppIcon },
}

const SOON = [
  { name: "iMessage", Icon: ImessageAppIcon },
  { name: "Discord", Icon: DiscordAppIcon },
  { name: "Slack", Icon: SlackAppIcon },
]

// Ways to reach the persona: a row for every number and bot, then the channels still to come. A row opens the Link panel (&link=<line id>).
// Under them, the connected chats, once there is one. Manage opens the project's settings, where numbers and bots are added.
export function ChannelsPage({ persona }: { persona: Persona }) {
  const { lines, chats, linesError, linesLoading, linksError } = useChannels(persona)
  const panels = usePanels()

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Channels</SectionTitle>
        <SectionDescription>
          Ways to reach <span className="font-semibold text-foreground">{persona.name}</span> directly.
        </SectionDescription>
      </SectionHeader>
      <ScreenSection>
        <div className="flex items-center gap-2">
          <ScreenSectionTitle>Numbers and bots {!linesLoading && !!lines.length && <ScreenSectionCount>{lines.length}</ScreenSectionCount>}</ScreenSectionTitle>
          <Button variant="ghost" size="xs" className="ms-auto text-muted-foreground" onClick={() => panels.openSettings("whatsapp")}>
            <SettingsIcon data-icon="inline-start" />
            Manage
          </Button>
        </div>
        {linesLoading && (
          <ScreenRows>
            {Array.from({ length: 3 }, (_, index) => (
              <ScreenRowSkeleton key={index} />
            ))}
          </ScreenRows>
        )}
        {linesError && (
          <ScreenEmpty role="alert">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                <CloudOffIcon />
              </EmptyMedia>
              <EmptyTitle>The numbers and bots did not load</EmptyTitle>
              <EmptyDescription>{linesError.message}</EmptyDescription>
            </EmptyHeader>
          </ScreenEmpty>
        )}
        {!linesLoading && !linesError && (
          <ScreenRows>
            {lines.map((line) => (
              <LineRow key={line.id} line={line} onOpen={() => panels.openLink(line.id)} />
            ))}
            {SOON.map((soon) => (
              <SoonRow key={soon.name} {...soon} />
            ))}
          </ScreenRows>
        )}
      </ScreenSection>
      {(linksError || !!chats?.length) && (
        <ScreenSection>
          <ScreenSectionTitle>Connected {!!chats?.length && <ScreenSectionCount>{chats.length}</ScreenSectionCount>}</ScreenSectionTitle>
          {linksError && (
            <ScreenEmpty role="alert">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                  <CloudOffIcon />
                </EmptyMedia>
                <EmptyTitle>Your chats did not load</EmptyTitle>
                <EmptyDescription>{linksError.message}</EmptyDescription>
              </EmptyHeader>
            </ScreenEmpty>
          )}
          {!!chats?.length && (
            <ScreenRows>
              {chats.map((chat) => (
                <ChatRow key={chat.id} personaId={persona.id} chat={chat} />
              ))}
            </ScreenRows>
          )}
        </ScreenSection>
      )}
    </Section>
  )
}

// A number or a bot: the app as the title, the number or the bot under it, and a Shared badge on the shared ones. The whole row opens the Link panel; a chevron shows on hover.
function LineRow({ line, onOpen }: { line: Line; onOpen: () => void }) {
  const brand = BRAND[line.channel]

  return (
    <ScreenRow className="relative">
      <ItemMedia variant="image">
        <brand.Icon className="size-full" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={onOpen} aria-label={`${brand.name} ${line.label}`} className="text-start outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {brand.name}
          </button>
        </ItemTitle>
        <ItemDescription className="tabular-nums">{line.label}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {line.shared && <Badge>Shared</Badge>}
        <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100 rtl:rotate-180" />
      </ItemActions>
    </ScreenRow>
  )
}

// A channel that is not built yet: its app icon, its name and Coming soon, all faded like a disabled control. It does nothing.
function SoonRow({ name, Icon }: (typeof SOON)[number]) {
  return (
    <ScreenRow aria-disabled className="opacity-50">
      <ItemMedia variant="image">
        <Icon className="size-full" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{name}</ItemTitle>
      </ItemContent>
      <ItemActions>
        <Badge variant="secondary">Coming soon</Badge>
      </ItemActions>
    </ScreenRow>
  )
}

// One connected chat: who, their phone on WhatsApp, the number or bot they write to, when they last wrote. Its menu holds Unlink, which asks first.
function ChatRow({ personaId, chat }: { personaId: string; chat: Chat }) {
  const unlink = useUnlink(personaId)
  const [confirming, setConfirming] = useState(false)
  const brand = BRAND[chat.channel]
  const phone = phoneOf(chat)
  const detail = [phone, chat.lineLabel && `on ${chat.lineLabel}`, lastMessage(chat.lastMessageAt)].filter(Boolean).join(" · ")

  async function unlinkChat() {
    await unlink.trigger({
      channel: chat.channel,
      line: chat.line,
      externalId: chat.externalId
    }, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Unlinked ${chat.name}`, type: "success" })
      },
    })
  }

  return (
    <ScreenRow>
      <ItemMedia variant="image">
        <brand.Icon className="size-full" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{chat.name}</ItemTitle>
        <ItemDescription>{detail}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${chat.name}`} className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100" />}>
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              Unlink
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink “{chat.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Their messages stop reaching this persona. They can link again with a new code.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlink.isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={unlink.isMutating} onClick={unlinkChat}>
              {unlink.isMutating && <Spinner data-icon="inline-start" />}
              {unlink.isMutating ? "Unlinking…" : "Unlink"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScreenRow>
  )
}

// The phone under the person's name: on Kapso it is their WhatsApp id, on Meta the phone the link kept. None when the name is the phone already, and none on Telegram
function phoneOf(chat: Chat) {
  if (!chat.label) return null
  if (chat.channel === "whatsapp") { return `+${chat.externalId}` }
  if (chat.channel === "whatsapp_meta") { return chat.phone }
  if (chat.channel === "telegram") { return null }

  throw new Error(`Unknown channel: ${chat.channel}`)
}

// Last message today · Last message Oct 9 · No messages yet
function lastMessage(at: string | null) {
  if (!at) return "No messages yet"
  const date = new Date(at)
  if (isToday(date)) return "Last message today"
  const day = format(date, isThisYear(date) ? "MMM d" : "MMM d, yyyy")
  return `Last message ${day}`
}
