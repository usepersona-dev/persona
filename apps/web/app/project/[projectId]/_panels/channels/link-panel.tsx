"use client"

import { CopyIcon } from "lucide-react"
import { useEffect } from "react"

import { TelegramIcon, WhatsappIcon } from "@/components/icons"
import { PersonaAvatar } from "@/components/persona-avatar"
import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldSeparator } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { useCreateLinkCode } from "@/hooks/links"
import type { Persona } from "@/hooks/personas"
import { cn } from "@/lib/utils"

import { chatUrl, codeMessage, inviteMessage, useChannels, type Channel, type Line } from "./use-channels"

const LOOK: Record<Channel, { app: string; Icon: typeof WhatsappIcon; button: string; copied: string }> = {
  whatsapp_meta: { app: "WhatsApp", Icon: WhatsappIcon, button: "bg-[#0B7A5E] text-white hover:bg-[#0B7A5E]/90", copied: "Number copied" },
  telegram: { app: "Telegram", Icon: TelegramIcon, button: "bg-[#1D7FC1] text-white hover:bg-[#1D7FC1]/90", copied: "Bot copied" },
}

// &link=<line id>, over the persona panel, drawn like the invite a person gets. Any page opens it with panels.openLink(line.id): it finds its number or bot, and makes a new code each time it opens.
// The code is a one-time key, so it never goes in the URL. The panel does not watch for the code's use: the bot confirms the link in the chat, and the Connected list picks it up on its next refetch.
export function LinkPanel({ persona, lineId, open, onOpenChange }: { persona: Persona; lineId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const line = useChannels(persona).lines.find((item) => item.id === lineId)
  const { data, isMutating, trigger } = useCreateLinkCode(persona.id)
  const title = line ? `Connect on ${LOOK[line.channel].app}` : "Connect a chat"

  useEffect(() => {
    if (open) void trigger()
  }, [open, trigger])

  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{title}</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section className="my-auto max-w-sm">
          <LinkContent persona={persona} line={line} code={data?.code} making={isMutating} onNewCode={() => void trigger()} />
        </Section>
      </SidePanelBody>
    </SidePanel>
  )
}

// The skeleton while the numbers and bots load or the code is made; Make a link when making the code failed
function LinkContent({ persona, line, code, making, onNewCode }: { persona: Persona; line: Line | undefined; code: string | undefined; making: boolean; onNewCode: () => void }) {
  if (!line || making) return <LinkSkeleton />
  if (!code) return <NoLinkView persona={persona} onNewCode={onNewCode} />
  return <InviteView persona={persona} line={line} code={code} />
}

function Head({ persona, children }: { persona: Persona; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-heading text-2xl leading-tight font-semibold">{persona.name}</p>
      <p className="text-sm text-balance text-muted-foreground">{children}</p>
    </div>
  )
}

// Chat on opens the app with the code inside, or the person sends the code by hand; when the number or bot has no public handle, the code is all there is, so it reads at full size
function InviteView({ persona, line, code }: { persona: Persona; line: Line; code: string }) {
  const url = chatUrl(line, code)
  const message = codeMessage(line, code)
  const look = LOOK[line.channel]

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <PersonaAvatar name={persona.name} imageUrl={persona.imageUrl} className="size-20 rounded-2xl" />
      <Head persona={persona}>
        For <span className="whitespace-nowrap text-foreground">{line.label}</span> on {look.app}.
      </Head>
      <div className="flex w-full flex-col gap-5">
        {url && (
          <>
            <a href={url} target="_blank" rel="noreferrer" className={cn(buttonVariants(), "h-11 w-full", look.button)}>
              <look.Icon data-icon="inline-start" />
              Chat on {look.app}
            </a>
            <FieldSeparator className="text-[11px] leading-5 font-semibold tracking-widest *:data-[slot=field-separator-content]:bg-sidebar *:data-[slot=field-separator-content]:pe-[calc(0.5rem-0.1em)]">OR</FieldSeparator>
          </>
        )}
        <p className={cn("text-xs leading-6 text-muted-foreground/70", !url && "text-sm text-muted-foreground")}>
          Send <CodeChip text={message} copied="Code copied" /> to <CodeChip text={line.label} copied={look.copied} />.
        </p>
        <Button variant="outline" className="h-11 w-full" onClick={() => copy(inviteMessage(line, code), "Invite copied")}>
          <CopyIcon data-icon="inline-start" />
          Copy invite
        </Button>
      </div>
    </div>
  )
}

// A bit of text to copy, drawn like inline code in a Markdown file
function CodeChip({ text, copied }: { text: string; copied: string }) {
  return (
    <button type="button" onClick={() => copy(text, copied)} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono leading-none whitespace-nowrap text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground">
      {text}
      <CopyIcon className="size-3 text-muted-foreground" />
    </button>
  )
}

function NoLinkView({ persona, onNewCode }: { persona: Persona; onNewCode: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <PersonaAvatar name={persona.name} imageUrl={persona.imageUrl} className="size-20 rounded-2xl" />
      <Head persona={persona}>There is no link yet.</Head>
      <Button className="h-11 w-full" onClick={onNewCode}>
        Make a link
      </Button>
    </div>
  )
}

function LinkSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Skeleton className="size-20 rounded-2xl" />
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex w-full flex-col items-center gap-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="mt-9 h-3 w-60" />
        <Skeleton className="mt-3 h-11 w-full" />
      </div>
    </div>
  )
}

async function copy(text: string, title: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    toast.add({ title: "Copy did not work", description: "Select the text and copy it.", type: "error" })
    return
  }

  toast.add({ title, type: "success" })
}
