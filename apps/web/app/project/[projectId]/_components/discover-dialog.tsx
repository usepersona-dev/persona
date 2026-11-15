"use client"

import { CompassIcon } from "lucide-react"
import { useEffect } from "react"

import { CirclePlusFilledIcon } from "@/components/icons"
import { PersonaAvatar } from "@/components/persona-avatar"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { usePersonas } from "@/hooks/personas"

import { usePanels } from "../_hooks/use-panels"

// Discover (?discover=true): one search to add a persona or open one, and later apps and stores.
// The sidebar item, ⌘K and a right-click on the empty canvas open it.
export function DiscoverDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { personas } = usePersonas(projectId)
  const panels = usePanels()

  useEffect(() => {
    function toggle(event: KeyboardEvent) {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      panels.toggleDiscover()
    }
    document.addEventListener("keydown", toggle)
    return () => document.removeEventListener("keydown", toggle)
  }, [panels])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Discover" description="Add a persona or install an app into this project.">
      <Command>
        <CommandInput placeholder="Search personas, apps and stores…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem value="discover personas" disabled>
              <CompassIcon className="size-5" />
              Discover
            </CommandItem>
            <CommandItem value="new persona" onSelect={panels.openCreate}>
              <CirclePlusFilledIcon className="size-5" />
              New Persona
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Personas">
            {personas?.map((persona) => (
              <CommandItem key={persona.id} value={`${persona.name} ${persona.id}`} onSelect={() => panels.openPersona(persona.id)}>
                <PersonaAvatar name={persona.name} imageUrl={persona.imageUrl} className="size-5" />
                {persona.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
