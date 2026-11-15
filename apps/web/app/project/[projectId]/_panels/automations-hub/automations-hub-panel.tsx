"use client"

import { CloudOffIcon, PlusIcon, SearchIcon, SearchXIcon } from "lucide-react"

import { ScreenEmpty, ScreenSection, ScreenSectionCount, ScreenSectionTitle } from "@/components/screen"
import { Section, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { Button } from "@/components/ui/button"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Item } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { useAutomationSuggestions, type Suggestion } from "@/hooks/automations"
import type { Persona } from "@/hooks/personas"

import { usePanels } from "../../_hooks/use-panels"
import { AutomationPanel } from "../automations/automation-panel"
import { planOf } from "../automations/schedule"
import { TimeTile } from "../automations/time-tile"
import { useAutomationsHub } from "./use-automations-hub"

// Ready-made automations, searched in one place. A tile opens New automation filled in from it over the hub (&automation=new:<id>), and nothing is saved until Create.
// The panel renders inside the hub, so the hub recedes under it as a panel does under the one opened from it.
export function AutomationsHubPanel({ persona, open, onOpenChange }: { persona: Persona; open: boolean; onOpenChange: (open: boolean) => void }) {
  const panels = usePanels()
  const { suggestions } = useAutomationSuggestions()
  const opened = panels.automation.data
  const suggestion = suggestions?.find((item) => `new:${item.id}` === opened)

  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <AutomationsHub onOpen={(suggestionId) => panels.openAutomation(`new:${suggestionId}`)} />
      {suggestion && <AutomationPanel key={opened} persona={persona} automation={null} suggestion={suggestion} open={panels.automation.open} onOpenChange={(next) => !next && panels.closeAutomation()} />}
    </SidePanel>
  )
}

// Inside the panel, so the search starts fresh each time the hub opens
function AutomationsHub({ onOpen }: { onOpen: (suggestionId: string) => void }) {
  const { query, changeQuery, total, suggestions, shown, error, isLoading, hasMore, loadMore } = useAutomationsHub()

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">Automations hub</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          <SectionHeader>
            <SectionTitle>Automations hub</SectionTitle>
            <SectionDescription>Ready-made automations to start from.</SectionDescription>
          </SectionHeader>
          <InputGroup className="h-11 bg-card">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={total ? `Search ${total} automations` : "Search automations"} aria-label="Search automations" />
          </InputGroup>
          {error && (
            <ScreenEmpty role="alert">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                  <CloudOffIcon />
                </EmptyMedia>
                <EmptyTitle>The automations hub did not load</EmptyTitle>
                <EmptyDescription>{error.message}</EmptyDescription>
              </EmptyHeader>
            </ScreenEmpty>
          )}
          {!error && (
            <ScreenSection>
              <ScreenSectionTitle>
                Suggested {!!suggestions?.length && <ScreenSectionCount>{suggestions.length}</ScreenSectionCount>}
              </ScreenSectionTitle>
              {isLoading && (
                <div className="grid gap-2.5 @md:grid-cols-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <SuggestionTileSkeleton key={index} />
                  ))}
                </div>
              )}
              {!!shown?.length && (
                <div className="grid gap-2.5 @md:grid-cols-2">
                  {shown.map((suggestion) => (
                    <SuggestionTile key={suggestion.id} suggestion={suggestion} onOpen={() => onOpen(suggestion.id)} />
                  ))}
                </div>
              )}
              {hasMore && (
                <Button variant="outline" className="self-center" onClick={loadMore}>
                  Load more
                </Button>
              )}
              {suggestions?.length === 0 && (
                <ScreenEmpty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchXIcon />
                    </EmptyMedia>
                    <EmptyTitle>No automations match “{query.trim()}”</EmptyTitle>
                    <EmptyDescription>Check the spelling, or try a shorter word.</EmptyDescription>
                  </EmptyHeader>
                  <Button variant="outline" size="sm" onClick={() => changeQuery("")}>
                    Clear search
                  </Button>
                </ScreenEmpty>
              )}
            </ScreenSection>
          )}
        </Section>
      </SidePanelBody>
    </>
  )
}

// A suggestion as an Integrations tile: its time tile, its name and what it does. A plus shows on hover, and the whole tile opens New automation filled in.
function SuggestionTile({ suggestion, onOpen }: { suggestion: Suggestion; onOpen: () => void }) {
  const plan = planOf({ cron: suggestion.cron, at: null })

  return (
    <Item variant="outline" size="sm" render={<button type="button" aria-label={`Start from ${suggestion.name}`} onClick={onOpen} />} className="group/tile flex-nowrap gap-3 bg-card px-3 py-2.5 text-start hover:border-foreground/20">
      <TimeTile plan={plan} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{suggestion.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{suggestion.description}</span>
      </span>
      <PlusIcon className="hidden size-3.5 shrink-0 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100 @lg:block" />
    </Item>
  )
}

function SuggestionTileSkeleton() {
  return (
    <Item aria-hidden variant="outline" size="sm" className="flex-nowrap gap-3 bg-card px-3 py-2.5">
      <Skeleton className="size-10 shrink-0 rounded-xl" />
      <span className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-full" />
      </span>
    </Item>
  )
}
