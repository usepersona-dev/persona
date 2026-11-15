"use client"

import { ChevronRightIcon, CloudOffIcon, SearchIcon, SearchXIcon } from "lucide-react"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton, ScreenSection, ScreenSectionCount, ScreenSectionTitle } from "@/components/screen"
import { Section, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import type { Persona } from "@/hooks/personas"
import type { MarketplaceSkill } from "@/hooks/skills"

import { usePanels } from "../../_hooks/use-panels"
import { HubSkillPanel } from "./hub-skill-panel"
import { installs, useSkillsHub } from "./use-skills-hub"

// skills.sh's skills, searched in one place. A row opens the skill's preview over the hub (&hubSkill=<id>), where it installs.
// The preview renders inside the hub, so the hub recedes under it as a panel does under the one opened from it.
export function SkillsHubPanel({ persona, open, onOpenChange }: { persona: Persona; open: boolean; onOpenChange: (open: boolean) => void }) {
  const panels = usePanels()

  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <SkillsHub persona={persona} onOpenSkill={panels.openHubSkill} />
      {panels.hubSkill.data && <HubSkillPanel key={panels.hubSkill.data} persona={persona} marketplaceId={panels.hubSkill.data} open={panels.hubSkill.open} onOpenChange={(next) => !next && panels.closeHubSkill()} />}
    </SidePanel>
  )
}

// Inside the panel, so the search starts fresh each time the hub opens
function SkillsHub({ persona, onOpenSkill }: { persona: Persona; onOpenSkill: (marketplaceId: string) => void }) {
  const { query, changeQuery, clear, search, skills, shown, error, isLoading, busy, hasMore, loadMore } = useSkillsHub(persona.id)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">Skills hub</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          <SectionHeader>
            <SectionTitle>Skills hub</SectionTitle>
            <SectionDescription>Ready-made skills from skills.sh, free to install.</SectionDescription>
          </SectionHeader>
          <InputGroup className="h-11 bg-card">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Search 90,000+ skills" aria-label="Search skills.sh" />
            {busy && (
              <InputGroupAddon align="inline-end">
                <Spinner />
              </InputGroupAddon>
            )}
          </InputGroup>
          {error && (
            <ScreenEmpty role="alert">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                  <CloudOffIcon />
                </EmptyMedia>
                <EmptyTitle>skills.sh did not answer</EmptyTitle>
                <EmptyDescription>{error.message}</EmptyDescription>
              </EmptyHeader>
            </ScreenEmpty>
          )}
          {!error && (
            <ScreenSection>
              <ScreenSectionTitle>
                {search ? "Results" : "Popular"} {!!skills?.length && <ScreenSectionCount>{skills.length}</ScreenSectionCount>}
              </ScreenSectionTitle>
              {isLoading && (
                <ScreenRows>
                  {Array.from({ length: 5 }, (_, index) => (
                    <ScreenRowSkeleton key={index} media={false} />
                  ))}
                </ScreenRows>
              )}
              {!!shown?.length && (
                <ScreenRows>
                  {shown.map((skill) => (
                    <HubSkillRow key={skill.id} skill={skill} installed={skill.installed} onOpen={() => onOpenSkill(skill.id)} />
                  ))}
                </ScreenRows>
              )}
              {hasMore && (
                <Button variant="outline" className="self-center" onClick={loadMore}>
                  Load more
                </Button>
              )}
              {skills?.length === 0 && (
                <ScreenEmpty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchXIcon />
                    </EmptyMedia>
                    <EmptyTitle>No skills match “{search}”</EmptyTitle>
                    <EmptyDescription>Check the spelling, or try a shorter name.</EmptyDescription>
                  </EmptyHeader>
                  <Button variant="outline" size="sm" onClick={clear}>
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

// A skills.sh skill: who publishes it and how many installed it. The whole row opens its preview, and a chevron shows on hover.
function HubSkillRow({ skill, installed, onOpen }: { skill: MarketplaceSkill; installed: boolean; onOpen: () => void }) {
  return (
    <ScreenRow className="relative">
      <ItemContent className="min-w-0">
        <ItemTitle className="min-w-0">
          <button type="button" onClick={onOpen} className="truncate text-start font-mono outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {skill.name}
          </button>
          {installed && <Badge variant="secondary">Installed</Badge>}
        </ItemTitle>
        <ItemDescription className="font-mono">
          {skill.source} · {installs(skill.installs)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100 rtl:rotate-180" />
      </ItemActions>
    </ScreenRow>
  )
}
