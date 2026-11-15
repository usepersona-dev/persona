"use client"

import { Controller } from "react-hook-form"

import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { Instruction } from "@/hooks/instructions"
import type { Persona } from "@/hooks/personas"

import { useInstructionForm } from "./use-instruction-form"

export function InstructionPanel({ persona, instruction, open, onOpenChange }: { persona: Persona; instruction: Instruction | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <InstructionForm persona={persona} instruction={instruction} onClose={() => onOpenChange(false)} />
    </SidePanel>
  )
}

// Inside the panel, so the form starts fresh each time the panel opens
function InstructionForm({ persona, instruction, onClose }: { persona: Persona; instruction: Instruction | null; onClose: () => void }) {
  const { form, submit, saving, deleting, confirming, setConfirming, deleteInstruction } = useInstructionForm(persona, instruction, onClose)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{instruction?.name ?? "New instruction"}</SidePanelTitle>
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
                  <input {...field} aria-label="Name" aria-invalid={fieldState.invalid} placeholder="Untitled instruction" autoComplete="off" className="w-full bg-transparent font-heading text-4xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="content"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Textarea {...field} aria-label="Instruction" aria-invalid={fieldState.invalid} placeholder="Write the rule for every chat." className="max-h-[50dvh] min-h-72 rounded-[10px] bg-card px-4 leading-7 md:text-base" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex justify-end gap-2">
              {instruction && (
                <Button type="button" variant="destructive" className="me-auto" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {instruction ? (saving ? "Saving…" : "Save") : saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Section>
      </SidePanelBody>
      {instruction && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{instruction.name}”?</AlertDialogTitle>
              <AlertDialogDescription>This instruction stops for good. To stop it for a while, turn it off instead.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteInstruction}>
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
