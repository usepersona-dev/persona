"use client"

import { SettingsIcon } from "lucide-react"

import { TelegramIcon, WhatsappIcon } from "@/components/icons"
import { ProjectAvatar } from "@/components/project-avatar"
import { SidePanel, SidePanelActions, SidePanelClose, SidePanelHeader, SidePanelTitle, usePanelState } from "@/components/side-panel"
import { DockTabs, Tabs, TabsContent } from "@/components/ui/dock-tabs"
import type { Project } from "@/hooks/projects"

import { usePanels } from "../_hooks/use-panels"
import { SettingsPage } from "./project-settings/settings-page"
import { TelegramPage } from "./project-settings/telegram-page"
import { WhatsappPage } from "./project-settings/whatsapp-page"

const PARTS: { value: string; label: string; icon: React.ComponentType; divider?: boolean; Page: React.ComponentType<{ project: Project }> }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: WhatsappIcon, Page: WhatsappPage },
  { value: "telegram", label: "Telegram", icon: TelegramIcon, Page: TelegramPage },
  { value: "settings", label: "Settings", icon: SettingsIcon, divider: true, Page: SettingsPage },
]

// The project's settings (?settings=true, from the project menu and the Channels page), laid out as the persona panel: the project's picture and Close on top, a part per page, and the dock at the foot
export function ProjectSettingsPanel({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (open: boolean) => void }) {
  const panels = usePanels()
  const part = usePanelState(panels.settings ? (panels.section ?? "settings") : null).data ?? "settings"

  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <Tabs value={part} onValueChange={(value) => panels.openSection(value)} className="min-h-0 flex-1 gap-0">
        <SidePanelHeader floating>
          <SidePanelTitle className="sr-only">{project.name} settings</SidePanelTitle>
          <ProjectAvatar name={project.name} imageUrl={project.imageUrl} className="size-10 rounded-xl" />
          <SidePanelActions>
            <SidePanelClose />
          </SidePanelActions>
        </SidePanelHeader>
        {PARTS.map((item) => (
          <TabsContent key={item.value} value={item.value} className="min-h-0 overflow-y-auto pt-16">
            <item.Page project={project} />
          </TabsContent>
        ))}
        <DockTabs items={PARTS} value={part} onValueChange={(value) => panels.openSection(value)} />
      </Tabs>
    </SidePanel>
  )
}
