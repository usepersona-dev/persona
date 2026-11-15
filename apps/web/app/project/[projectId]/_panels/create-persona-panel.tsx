"use client"

import { PlusIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { PersonaAvatar } from "@/components/persona-avatar"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

import { useCreatePersonaForm } from "../_hooks/use-create-persona-form"

// New persona and Duplicate in one panel: ?create=new picks Blank, and ?create=<id> picks that persona to copy. The new persona's face stands on top, then the name and the strip to start from.
export function CreatePersonaPanel({ projectId, from, open, onOpenChange }: { projectId: string; from: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">New persona</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody>
        <CreateForm key={from} projectId={projectId} from={from} />
      </SidePanelBody>
    </SidePanel>
  )
}

// Keyed by what it starts from, so the form starts fresh each time the panel opens on another pick
function CreateForm({ projectId, from }: { projectId: string; from: string }) {
  const { form, personas, picked, name, creating, pick, submit } = useCreatePersonaForm(projectId, from)
  const copying = !!picked

  return (
    <form onSubmit={submit} className="mx-auto my-auto flex w-full max-w-lg flex-col items-center gap-7 px-6 py-16">
      {name.trim() || picked?.imageUrl ? <PersonaAvatar name={name.trim()} imageUrl={picked?.imageUrl} className="size-20 rounded-2xl" /> : <BlankFace className="size-20 rounded-2xl [&_svg]:size-6" />}
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <input {...field} aria-label="Name" aria-invalid={fieldState.invalid} placeholder="Untitled persona" autoComplete="off" className="w-full bg-transparent text-center font-heading text-4xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
            <FieldError errors={[fieldState.error]} className="text-center" />
          </Field>
        )}
      />
      <div className="flex w-full flex-col items-center gap-2.5">
        <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Start from</p>
        <div className="scroll-fade-x w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div role="radiogroup" aria-label="Start from" className="mx-auto flex w-max gap-2 p-1">
            <Tile label="Blank" selected={!copying} onSelect={() => pick(null)}>
              <BlankFace />
            </Tile>
            {personas?.map((persona) => (
              <Tile key={persona.id} label={persona.name} selected={persona.id === picked?.id} onSelect={() => pick(persona.id)}>
                <PersonaAvatar name={persona.name} imageUrl={persona.imageUrl} className="size-11 rounded-lg" />
              </Tile>
            ))}
          </div>
        </div>
      </div>
      <p className="max-w-sm text-center text-xs text-muted-foreground/70">{copying ? "Copies the instructions, skills, vault fields and automations. Automations start paused, and vault values stay behind." : "Starts empty: no instructions, skills or files yet."}</p>
      <Button type="submit" size="lg" disabled={creating}>
        {creating && <Spinner data-icon="inline-start" />}
        {creating ? "Creating…" : "Create"}
      </Button>
    </form>
  )
}

// The Preferences tile (settings/preferences), wider so a persona's name fits
function Tile({ label, selected, onSelect, children }: { label: string; selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={selected} title={label} onClick={onSelect} className={cn("flex w-22 flex-col items-center gap-1.5 rounded-xl p-1.5 text-xs font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", selected ? "bg-primary/10 text-foreground ring-2 ring-primary" : "text-muted-foreground hover:bg-muted")}>
      {children}
      <span className="w-full truncate text-center">{label}</span>
    </button>
  )
}

function BlankFace({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-11 items-center justify-center rounded-lg border-2 border-dashed border-foreground/15 text-muted-foreground", className)}>
      <PlusIcon className="size-4" />
    </span>
  )
}
