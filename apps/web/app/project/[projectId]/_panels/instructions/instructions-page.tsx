"use client"

import { CloudOffIcon, PlusIcon, ScrollTextIcon } from "lucide-react"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { useInstructions, useUpdateInstruction, type Instruction } from "@/hooks/instructions"
import type { Persona } from "@/hooks/personas"
import { cn } from "@/lib/utils"

import { usePanels } from "../../_hooks/use-panels"
import { InstructionPanel } from "./instruction-panel"

// The persona's instructions, the rules it follows in every chat while they are on. A row opens its panel (&instruction=<id>, or new), which holds while it slides out.
export function InstructionsPage({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { instructions, error, isLoading } = useInstructions(persona.id)
  const edited = instructions?.find((instruction) => instruction.id === panels.instruction.data)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Instructions</SectionTitle>
        <SectionDescription>
          Rules <span className="font-semibold text-foreground">{persona.name}</span> follows in every chat.
        </SectionDescription>
        <SectionAction>
          <Button size="sm" onClick={() => panels.openInstruction("new")}>
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
            <EmptyTitle>Your instructions did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {instructions?.length === 0 && (
        <ScreenEmpty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollTextIcon />
            </EmptyMedia>
            <EmptyTitle>No instructions yet</EmptyTitle>
            <EmptyDescription>Instructions you add show up here.</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {!!instructions?.length && (
        <ScreenRows>
          {instructions.map((instruction) => (
            <InstructionRow key={instruction.id} instruction={instruction} onOpen={() => panels.openInstruction(instruction.id)} />
          ))}
        </ScreenRows>
      )}
      {(panels.instruction.data === "new" || edited) && <InstructionPanel key={panels.instruction.data} persona={persona} instruction={edited ?? null} open={panels.instruction.open} onOpenChange={(open) => !open && panels.closeInstruction()} />}
    </Section>
  )
}

// The whole row opens the instruction, and its switch turns it on or off in place.
function InstructionRow({ instruction, onOpen }: { instruction: Instruction; onOpen: () => void }) {
  const update = useUpdateInstruction(instruction)

  function toggle(enabled: boolean) {
    void update.trigger({ enabled }, { optimisticData: (list: Instruction[] = []) => list.map((item) => (item.id === instruction.id ? { ...item, enabled } : item)) })
  }

  return (
    <ScreenRow className={cn("relative", !instruction.enabled && "opacity-60")}>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={onOpen} className="text-start outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {instruction.name}
          </button>
        </ItemTitle>
        <ItemDescription>{instruction.enabled ? instruction.content : `Off · ${instruction.content}`}</ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <Switch checked={instruction.enabled} onCheckedChange={toggle} aria-label={instruction.enabled ? `Turn off ${instruction.name}` : `Turn on ${instruction.name}`} />
      </ItemActions>
    </ScreenRow>
  )
}
