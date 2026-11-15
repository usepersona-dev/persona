"use client"

import { BlocksIcon, CalendarClockIcon, CpuIcon, GraduationCapIcon, KeyRoundIcon, LockIcon, MessageCircleIcon, MessageSquareIcon, ScrollTextIcon, SettingsIcon, WebhookIcon } from "lucide-react"

import { PersonaAvatar } from "@/components/persona-avatar"
import { SidePanel, SidePanelActions, SidePanelClose, SidePanelHeader, SidePanelTitle, usePanelState } from "@/components/side-panel"
import { DockTabs, Tabs, TabsContent } from "@/components/ui/dock-tabs"
import type { Persona } from "@/hooks/personas"
import { cn } from "@/lib/utils"

import { ChatPage } from "./chat/chat-page"
import { InstructionsPage } from "./instructions/instructions-page"
import { ModelsPage } from "./models/models-page"
import { IntegrationsPage } from "./integrations/integrations-page"
import { AutomationsPage } from "./automations/automations-page"
import { WebhooksPage } from "./webhooks/webhooks-page"
import { ChannelsPage } from "./channels/channels-page"
import { LinkPanel } from "./channels/link-panel"
import { ConnectionsPage } from "./connections/connections-page"
import { VaultPage } from "./vault/vault-page"
import { SkillsPage } from "./skills/skills-page"
import { SettingsPage } from "./settings/settings-page"
import { usePanels } from "../_hooks/use-panels"

const PAGES: { value: string; label: string; icon: React.ComponentType; divider?: boolean; more?: boolean; Page: React.ComponentType<{ persona: Persona }>; fill?: boolean; keepMounted?: boolean }[] = [
  { value: "chat", label: "Chat", icon: MessageSquareIcon, Page: ChatPage, fill: true, keepMounted: true },
  { value: "instructions", label: "Instructions", icon: ScrollTextIcon, Page: InstructionsPage },
  { value: "skills", label: "Skills", icon: GraduationCapIcon, Page: SkillsPage },
  { value: "channels", label: "Channels", icon: MessageCircleIcon, Page: ChannelsPage },
  { value: "automations", label: "Automations", icon: CalendarClockIcon, Page: AutomationsPage },
  { value: "integrations", label: "Integrations", icon: BlocksIcon, Page: IntegrationsPage },
  { value: "vault", label: "Vault", icon: LockIcon, Page: VaultPage },
  { value: "models", label: "Models", icon: CpuIcon, divider: true, more: true, Page: ModelsPage },
  { value: "connections", label: "Connections", icon: KeyRoundIcon, more: true, Page: ConnectionsPage },
  { value: "webhooks", label: "Webhooks", icon: WebhookIcon, more: true, Page: WebhooksPage },
  { value: "settings", label: "Settings", icon: SettingsIcon, divider: true, more: true, Page: SettingsPage },
]

// The pages are keyed by persona, so another persona starts each page over, its own chats included. The Link panel sits here, over every page, so any page can open it
export function PersonaPanel({ persona, open, onOpenChange }: { persona: Persona; open: boolean; onOpenChange: (open: boolean) => void }) {
  const panels = usePanels()
  const page = usePanelState(panels.persona && (panels.section ?? "chat")).data ?? "chat"

  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <Tabs value={page} onValueChange={(value) => panels.openSection(value)} className="min-h-0 flex-1 gap-0">
        <SidePanelHeader floating>
          <SidePanelTitle className="sr-only">{persona.name}</SidePanelTitle>
          <PersonaAvatar name={persona.name} imageUrl={persona.imageUrl} className="size-10 rounded-xl" />
          <SidePanelActions>
            <SidePanelClose />
          </SidePanelActions>
        </SidePanelHeader>
        {PAGES.map((item) => (
          <TabsContent key={item.value} value={item.value} keepMounted={item.keepMounted} className={cn("min-h-0", item.fill ? "overflow-hidden" : "overflow-y-auto pt-16")}>
            <item.Page key={persona.id} persona={persona} />
          </TabsContent>
        ))}
        <DockTabs items={PAGES} value={page} onValueChange={(value) => panels.openSection(value)} />
      </Tabs>
      {panels.link.data && <LinkPanel
        key={panels.link.data}
        persona={persona}
        lineId={panels.link.data}
        open={panels.link.open}
        onOpenChange={(open) => !open && panels.closeLink()} />
      }
    </SidePanel>
  )
}
