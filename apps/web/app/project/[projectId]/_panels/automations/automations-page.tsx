"use client"

import { CalendarClockIcon, CloudOffIcon, CompassIcon, PlusIcon } from "lucide-react"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { useAutomations, useUpdateAutomation, type Automation } from "@/hooks/automations"
import type { Persona } from "@/hooks/personas"
import { cn } from "@/lib/utils"

import { usePanels } from "../../_hooks/use-panels"
import { AutomationsHubPanel } from "../automations-hub/automations-hub-panel"
import { AutomationPanel } from "./automation-panel"
import { describe, planOf } from "./schedule"
import { TimeTile } from "./time-tile"

// The persona's automations. A row opens its panel (&automation=<id>, or new), and Discover opens the automations hub (&automationsHub=true). Each holds while it slides out.
export function AutomationsPage({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { automations, error, isLoading } = useAutomations(persona.id)
  const edited = automations?.find((automation) => automation.id === panels.automation.data)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Automations</SectionTitle>
        <SectionDescription>Tasks that run on their own, on a schedule.</SectionDescription>
        <SectionAction>
          <Button variant="outline" size="sm" onClick={panels.openAutomationsHub}>
            <CompassIcon data-icon="inline-start" />
            Discover
          </Button>
          <Button size="sm" onClick={() => panels.openAutomation("new")}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        </SectionAction>
      </SectionHeader>
      {isLoading && (
        <ScreenRows>
          {Array.from({ length: 3 }, (_, index) => (
            <ScreenRowSkeleton key={index} />
          ))}
        </ScreenRows>
      )}
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>Your automations did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {automations?.length === 0 && (
        <ScreenEmpty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClockIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing scheduled yet</EmptyTitle>
            <EmptyDescription>Automations you add show up here.</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {!!automations?.length && (
        <ScreenRows>
          {automations.map((automation) => (
            <AutomationRow key={automation.id} automation={automation} onOpen={() => panels.openAutomation(automation.id)} />
          ))}
        </ScreenRows>
      )}
      {(panels.automation.data === "new" || edited) && <AutomationPanel key={panels.automation.data} persona={persona} automation={edited ?? null} suggestion={null} open={panels.automation.open} onOpenChange={(open) => !open && panels.closeAutomation()} />}
      {panels.automationsHub.data && <AutomationsHubPanel persona={persona} open={panels.automationsHub.open} onOpenChange={(open) => !open && panels.closeAutomationsHub()} />}
    </Section>
  )
}

// The whole row opens the automation, and its switch pauses or resumes it in place. The time tile leads.
function AutomationRow({ automation, onOpen }: { automation: Automation; onOpen: () => void }) {
  const update = useUpdateAutomation(automation)
  const plan = planOf(automation)

  function toggle(enabled: boolean) {
    void update.trigger({ enabled }, { optimisticData: (list: Automation[] = []) => list.map((item) => (item.id === automation.id ? { ...item, enabled } : item)) })
  }

  return (
    <ScreenRow className={cn("relative", !automation.enabled && "opacity-60")}>
      <ItemMedia>
        <TimeTile plan={plan} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={onOpen} className="text-start outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {automation.name}
          </button>
        </ItemTitle>
        <ItemDescription>{automation.enabled ? describe(plan) : `Paused · ${describe(plan)}`}</ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <Switch checked={automation.enabled} onCheckedChange={toggle} aria-label={automation.enabled ? `Pause ${automation.name}` : `Resume ${automation.name}`} />
      </ItemActions>
    </ScreenRow>
  )
}
