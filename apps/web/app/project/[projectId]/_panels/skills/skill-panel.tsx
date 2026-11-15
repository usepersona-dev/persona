"use client"

import { CloudOffIcon, FolderIcon, PackageIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { Edit, Property } from "@/components/property"
import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { Persona } from "@/hooks/personas"
import { useSkill, type Skill } from "@/hooks/skills"

import { useSkillForm } from "./use-skill-form"

// A new skill (skillId null) or a saved one, which loads in full first: the list has no steps or files
export function SkillPanel({ persona, skillId, open, onOpenChange }: { persona: Persona; skillId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const close = () => onOpenChange(false)

  return <SidePanel open={open} onOpenChange={onOpenChange}>{skillId ? <SavedSkill persona={persona} skillId={skillId} onClose={close} /> : <SkillForm persona={persona} skill={null} onClose={close} />}</SidePanel>
}

function SavedSkill({ persona, skillId, onClose }: { persona: Persona; skillId: string; onClose: () => void }) {
  const { skill, error } = useSkill(skillId)
  if (skill) return <SkillForm persona={persona} skill={skill} onClose={onClose} />

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">Skill</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          {error ? (
            <Empty role="alert">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                  <CloudOffIcon />
                </EmptyMedia>
                <EmptyTitle>This skill did not load</EmptyTitle>
                <EmptyDescription>{error.message}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <SkillSkeleton />
          )}
        </Section>
      </SidePanelBody>
    </>
  )
}

// Inside the panel, so the form starts fresh each time the panel opens
function SkillForm({ persona, skill, onClose }: { persona: Persona; skill: Skill | null; onClose: () => void }) {
  const { form, submit, saving, deleting, confirming, setConfirming, deleteSkill } = useSkillForm(persona, skill, onClose)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{skill?.name ?? "New skill"}</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <input {...field} onChange={(event) => field.onChange(event.target.value.toLowerCase().replaceAll(" ", "-"))} aria-label="Name" aria-invalid={fieldState.invalid} placeholder="skill-name" autoComplete="off" spellCheck={false} className="w-full bg-transparent font-mono text-3xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            {skill && (
              <div className="flex flex-col gap-1">
                <Property icon={PackageIcon} label="Source">
                  <span className="truncate font-mono text-sm">{origin(skill.origin, persona.name)}</span>
                </Property>
                {!!skill.files.length && <FilesProperty paths={skill.files.map((file) => file.path)} />}
              </div>
            )}
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="skill-description">When to use it</FieldLabel>
                  <Textarea {...field} id="skill-description" aria-invalid={fieldState.invalid} placeholder="Describe the tasks this skill is for." className="max-h-[30dvh] min-h-16 rounded-[10px] bg-card px-4 leading-7 md:text-base" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="markdown"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="skill-markdown">How to do it</FieldLabel>
                  <Textarea {...field} id="skill-markdown" aria-invalid={fieldState.invalid} placeholder="Write the steps to follow." className="max-h-[50dvh] min-h-72 rounded-[10px] bg-card px-4 leading-7 md:text-base" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex justify-end gap-2">
              {skill && (
                <Button type="button" variant="destructive" className="me-auto" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {skill ? (saving ? "Saving…" : "Save") : saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Section>
      </SidePanelBody>
      {skill && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{skill.name}”?</AlertDialogTitle>
              <AlertDialogDescription>This skill and its files go for good. To stop it for a while, turn it off instead.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteSkill}>
                {deleting && <Spinner data-icon="inline-start" />}
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

// The files a skill keeps beside its steps, by path. They come with a skill from skills.sh and stay as they are.
export function FilesProperty({ paths }: { paths: string[] }) {
  return (
    <Property icon={FolderIcon} label="Files">
      <Edit value={paths.length === 1 ? "1 file" : `${paths.length} files`}>
        <ul className="flex max-h-72 w-[min(24rem,calc(100vw-4rem))] flex-col gap-1 overflow-y-auto font-mono text-xs">
          {paths.map((path) => (
            <li key={path} className="truncate">
              {path}
            </li>
          ))}
        </ul>
      </Edit>
    </Property>
  )
}

// The skills.sh id then Hub, Custom for one written here, or the persona's name for one the persona saved
function origin({ kind, id }: { kind: string; id: string | null }, personaName: string) {
  if (kind === "hub") return `${id} · Hub`
  if (kind === "agent") return personaName
  return "Custom"
}

// A skill while it loads: its title, two property rows (origin and files, or source and installs), then the two texts
export function SkillSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-10 w-2/3" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="grid min-h-9 grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}
