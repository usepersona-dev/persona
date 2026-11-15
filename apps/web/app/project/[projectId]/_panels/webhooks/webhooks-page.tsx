"use client"

import { CloudOffIcon, PlusIcon, WebhookIcon } from "lucide-react"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { useLinks } from "@/hooks/links"
import type { Persona } from "@/hooks/personas"
import { useUpdateWebhook, useWebhooks, type Webhook } from "@/hooks/webhooks"
import { cn } from "@/lib/utils"

import { usePanels } from "../../_hooks/use-panels"
import { chatsOf } from "./use-webhook-form"
import { WebhookPanel } from "./webhook-panel"

// The persona's webhooks. A row opens its panel (&webhook=<id>, or new), which holds while it slides out. After Create the panel moves on to the new webhook, so its address can be copied.
export function WebhooksPage({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { webhooks, error, isLoading } = useWebhooks(persona.id)
  const { links } = useLinks(persona.id)
  const chats = chatsOf(links)
  const edited = webhooks?.find((webhook) => webhook.id === panels.webhook.data)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Webhooks</SectionTitle>
        <SectionDescription>Tasks that run when another app calls their address.</SectionDescription>
        <SectionAction>
          <Button size="sm" onClick={() => panels.openWebhook("new")}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        </SectionAction>
      </SectionHeader>
      {isLoading && (
        <ScreenRows>
          {Array.from({ length: 3 }, (_, index) => (
            <ScreenRowSkeleton key={index} media={false} />
          ))}
        </ScreenRows>
      )}
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>Your webhooks did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {webhooks?.length === 0 && (
        <ScreenEmpty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WebhookIcon />
            </EmptyMedia>
            <EmptyTitle>No webhooks yet</EmptyTitle>
            <EmptyDescription>Webhooks you add show up here.</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {!!webhooks?.length && (
        <ScreenRows>
          {webhooks.map((webhook) => (
            <WebhookRow key={webhook.id} webhook={webhook} chats={chats} onOpen={() => panels.openWebhook(webhook.id)} />
          ))}
        </ScreenRows>
      )}
      {(panels.webhook.data === "new" || edited) && <WebhookPanel persona={persona} webhook={edited ?? null} open={panels.webhook.open} onOpenChange={(open) => !open && panels.closeWebhook()} onCreated={panels.openWebhook} />}
    </Section>
  )
}

// The whole row opens the webhook, and its switch pauses or resumes it in place. A paused webhook turns its calls away.
function WebhookRow({ webhook, chats, onOpen }: { webhook: Webhook; chats: { value: string; label: string }[]; onOpen: () => void }) {
  const update = useUpdateWebhook(webhook)
  const chat = chats.find((item) => item.value === webhook.linkId)
  const sendTo = chat ? `Sends to ${chat.label}` : "Sends to no one"

  function toggle(enabled: boolean) {
    void update.trigger({ enabled }, { optimisticData: (list: Webhook[] = []) => list.map((item) => (item.id === webhook.id ? { ...item, enabled } : item)) })
  }

  return (
    <ScreenRow className={cn("relative", !webhook.enabled && "opacity-60")}>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={onOpen} className="text-start outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {webhook.name}
          </button>
        </ItemTitle>
        <ItemDescription>{webhook.enabled ? sendTo : `Paused · ${sendTo}`}</ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <Switch checked={webhook.enabled} onCheckedChange={toggle} aria-label={webhook.enabled ? `Pause ${webhook.name}` : `Resume ${webhook.name}`} />
      </ItemActions>
    </ScreenRow>
  )
}
