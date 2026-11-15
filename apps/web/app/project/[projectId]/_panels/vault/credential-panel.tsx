"use client"

import { LinkIcon, LockIcon, LockOpenIcon, PlusIcon, XIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Persona } from "@/hooks/personas"
import type { VaultCredential } from "@/hooks/vault"
import { cn } from "@/lib/utils"

import type { StartField } from "./presets"
import { useCredentialForm, type CredentialField } from "./use-credential-form"

export function CredentialPanel({ persona, credential, start, open, onOpenChange }: { persona: Persona; credential: VaultCredential | null; start: StartField[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <CredentialForm persona={persona} credential={credential} start={start} onClose={() => onOpenChange(false)} />
    </SidePanel>
  )
}

// Inside the panel, so the form starts fresh each time the panel opens
function CredentialForm({ persona, credential, start, onClose }: { persona: Persona; credential: VaultCredential | null; start: StartField[]; onClose: () => void }) {
  const { form, submit, saving, deleting, confirming, setConfirming, deleteCredential, copyLink, copying } = useCredentialForm(persona, credential, start, onClose)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{credential?.title ?? "New credential"}</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Controller
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <input {...field} aria-label="Title" aria-invalid={fieldState.invalid} placeholder="Untitled credential" autoComplete="off" className="w-full bg-transparent font-heading text-4xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller control={form.control} name="fields" render={({ field, fieldState }) => <Fields fields={field.value} onChange={field.onChange} error={fieldState.error?.message} />} />
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="credential-description">When to use it</FieldLabel>
                  <Textarea {...field} id="credential-description" aria-invalid={fieldState.invalid} placeholder="Describe when this is the one to use." className="max-h-[50dvh] min-h-32 rounded-[10px] bg-card px-4 leading-7 md:text-base" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex justify-end gap-2">
              {credential && (
                <>
                  <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
                    Delete
                  </Button>
                  <Button type="button" variant="outline" className="me-auto" disabled={copying} onClick={copyLink}>
                    {copying ? <Spinner data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
                    Copy link
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {credential ? (saving ? "Saving…" : "Save") : saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Section>
      </SidePanelBody>
      {credential && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{credential.title}”?</AlertDialogTitle>
              <AlertDialogDescription>This credential and its saved values go for good.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteCredential}>
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

// One row per field: its name, its value, whether it is secret, and its remove. A saved value shows as dots, typing replaces it, and a filled field keeps its name.
// Secret values are masked with text-security, not type="password", so the browser does not offer to save them as a site password.
function Fields({ fields, onChange, error }: { fields: CredentialField[]; onChange: (fields: CredentialField[]) => void; error?: string }) {
  function set(index: number, change: Partial<CredentialField>) {
    onChange(fields.map((field, at) => (at === index ? { ...field, ...change } : field)))
  }

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
          <Input value={field.name} disabled={field.filled} onChange={(event) => set(index, { name: event.target.value })} placeholder="Name" aria-label="Field name" autoComplete="off" spellCheck={false} />
          <Input value={field.value} onChange={(event) => set(index, { value: event.target.value })} placeholder={field.filled ? "••••••••" : "Value"} aria-label={`${field.name || "Field"} value`} autoComplete="off" spellCheck={false} className={cn(field.secret && "[-webkit-text-security:disc]")} />
          <div className="flex">
            <Tooltip>
              <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-pressed={field.secret} aria-label={`${field.name || "Field"} is secret`} onClick={() => set(index, { secret: !field.secret })} />}>
                {field.secret ? <LockIcon /> : <LockOpenIcon className="text-muted-foreground" />}
              </TooltipTrigger>
              <TooltipContent>{field.secret ? "Secret: shown as dots" : "Not secret: shown as typed"}</TooltipContent>
            </Tooltip>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(fields.filter((_, at) => at !== index))} aria-label={`Remove ${field.name || "field"}`}>
              <XIcon />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...fields, { name: "", secret: true, value: "", filled: false }])}>
        <PlusIcon data-icon="inline-start" />
        Add field
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}
