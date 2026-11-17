"use client"

import { CloudOffIcon, CompassIcon, GraduationCapIcon, PlusIcon, SearchIcon, SearchXIcon, SlidersHorizontalIcon } from "lucide-react"

import { Filter } from "@/components/filter"
import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton, ScreenSection, ScreenSectionCount, ScreenSectionTitle } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import type { Persona } from "@/hooks/personas"
import { useUpdateSkill, type SkillSummary } from "@/hooks/skills"
import { cn } from "@/lib/utils"

import { usePanels } from "../../_hooks/use-panels"
import { SkillsHubPanel } from "../skills-hub/skills-hub-panel"
import { SkillPanel } from "./skill-panel"
import { useSkillList } from "./use-skill-list"

// The persona's skills. A row opens its panel (&skill=<id>, or new), and Discover opens skills.sh's hub (&skillsHub=true). Each holds while it slides out.
export function SkillsPage({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { query, setQuery, origin, setOrigin, origins, clear, skills, shown, error, isLoading } = useSkillList(persona)
  const edited = skills?.find((skill) => skill.id === panels.skill.data)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Skills</SectionTitle>
        <SectionDescription>
          Guides <span className="font-semibold text-foreground">{persona.name}</span> follows for specific tasks.
        </SectionDescription>
        <SectionAction>
          <Button variant="outline" size="sm" onClick={panels.openSkillsHub}>
            <CompassIcon data-icon="inline-start" />
            Discover
          </Button>
          <Button size="sm" onClick={() => panels.openSkill("new")}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        </SectionAction>
      </SectionHeader>
      {!!skills?.length && (
        <InputGroup className="h-11 bg-card">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills" aria-label="Search skills" />
        </InputGroup>
      )}
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
            <EmptyTitle>Your skills did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {skills?.length === 0 && (
        <ScreenEmpty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GraduationCapIcon />
            </EmptyMedia>
            <EmptyTitle>No skills yet</EmptyTitle>
            <EmptyDescription>Skills you write or install show up here.</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {!!skills?.length && (
        <ScreenSection>
          <div className="flex items-center gap-1">
            <ScreenSectionTitle className="me-auto">
              All skills <ScreenSectionCount>{shown?.length}</ScreenSectionCount>
            </ScreenSectionTitle>
            <Filter icon={SlidersHorizontalIcon} label="Source" value={origin} options={origins} onChange={setOrigin} />
          </div>
          {!!shown?.length && (
            <ScreenRows>
              {shown.map((skill) => (
                <SkillRow key={skill.id} personaId={persona.id} skill={skill} onOpen={() => panels.openSkill(skill.id)} />
              ))}
            </ScreenRows>
          )}
          {shown?.length === 0 && (
            <ScreenEmpty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No skills match</EmptyTitle>
                <EmptyDescription>Check the spelling, or pick another source.</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={clear}>
                Clear filters
              </Button>
            </ScreenEmpty>
          )}
        </ScreenSection>
      )}
      {(panels.skill.data === "new" || edited) && <SkillPanel key={panels.skill.data} persona={persona} skillId={edited?.id ?? null} open={panels.skill.open} onOpenChange={(open) => !open && panels.closeSkill()} />}
      {panels.skillsHub.data && <SkillsHubPanel persona={persona} open={panels.skillsHub.open} onOpenChange={(open) => !open && panels.closeSkillsHub()} />}
    </Section>
  )
}

// The whole row opens the skill, and its switch turns it on or off in place.
function SkillRow({ personaId, skill, onOpen }: { personaId: string; skill: SkillSummary; onOpen: () => void }) {
  const update = useUpdateSkill({ id: skill.id, personaId })

  function toggle(enabled: boolean) {
    void update.trigger({ enabled }, { optimisticData: (list: SkillSummary[] = []) => list.map((item) => (item.id === skill.id ? { ...item, enabled } : item)) })
  }

  return (
    <ScreenRow className={cn("relative", !skill.enabled && "opacity-60")}>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={onOpen} className="text-start font-mono outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {skill.name}
          </button>
        </ItemTitle>
        <ItemDescription>{skill.description}</ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <Switch checked={skill.enabled} onCheckedChange={toggle} aria-label={skill.enabled ? `Turn off ${skill.name}` : `Turn on ${skill.name}`} />
      </ItemActions>
    </ScreenRow>
  )
}
