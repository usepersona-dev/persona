"use client"

import { KeyRoundIcon, LinkIcon, PlusIcon, WrenchIcon, XIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { Edit, Property } from "@/components/property"
import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { Connection } from "@/hooks/connections"
import type { Persona } from "@/hooks/personas"

import { useConnectionForm, type Header } from "./use-connection-form"

export function ConnectionPanel({ persona, connection, open, onOpenChange }: { persona: Persona; connection: Connection | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <ConnectionForm persona={persona} connection={connection} onClose={() => onOpenChange(false)} />
    </SidePanel>
  )
}

// Inside the panel, so the form starts fresh each time the panel opens
function ConnectionForm({ persona, connection, onClose }: { persona: Persona; connection: Connection | null; onClose: () => void }) {
  const { form, submit, saving, deleting, confirming, setConfirming, deleteConnection, checking, probe, checkServer } = useConnectionForm(persona, connection, onClose)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{connection?.name ?? "New connection"}</SidePanelTitle>
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
                  <input {...field} onChange={(event) => field.onChange(event.target.value.toLowerCase().replaceAll(" ", "-"))} aria-label="Name" aria-invalid={fieldState.invalid} placeholder="server-name" autoComplete="off" spellCheck={false} className="w-full bg-transparent font-heading text-4xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex flex-col gap-1">
              <Controller
                control={form.control}
                name="url"
                render={({ field, fieldState }) => (
                  <>
                    <Property icon={LinkIcon} label="Address">
                      <Edit value={field.value || "Add the address"} invalid={fieldState.invalid}>
                        <Input {...field} type="url" aria-label="Address" aria-invalid={fieldState.invalid} placeholder="https://example.com/mcp" autoComplete="off" spellCheck={false} className="w-80" />
                      </Edit>
                    </Property>
                    <FieldError errors={[fieldState.error]} className="ps-36" />
                  </>
                )}
              />
              <Controller control={form.control} name="headers" render={({ field, fieldState }) => <HeaderProperty headers={field.value} onChange={field.onChange} error={fieldState.error?.message} />} />
              <Property icon={WrenchIcon} label="Tools">
                <Button type="button" variant="secondary" size="sm" disabled={checking} aria-invalid={probe?.ok === false} onClick={checkServer} className="max-w-full">
                  {checking && <Spinner data-icon="inline-start" />}
                  <span className="truncate">{checking ? "Checking…" : probe?.ok ? tools(probe.tools.length) : "Check"}</span>
                </Button>
              </Property>
              {probe?.ok === false && <FieldError className="ps-36">{probe.message}</FieldError>}
            </div>
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="connection-description">What it is for</FieldLabel>
                  <Textarea {...field} id="connection-description" aria-invalid={fieldState.invalid} placeholder="Describe what the server does and when to use it." className="max-h-[50dvh] min-h-40 rounded-[10px] bg-card px-4 leading-7 md:text-base" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex justify-end gap-2">
              {connection && (
                <Button type="button" variant="destructive" className="me-auto" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {connection ? (saving ? "Saving…" : "Save") : saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Section>
      </SidePanelBody>
      {connection && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{connection.name}”?</AlertDialogTitle>
              <AlertDialogDescription>This connection and its headers go for good. To stop it for a while, turn it off instead.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteConnection}>
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

// The headers sent with every request. A saved header shows only its name: a new value replaces it, and its X takes it out.
function HeaderProperty({ headers, onChange, error }: { headers: Header[]; onChange: (headers: Header[]) => void; error?: string }) {
  const names = headers.map((header) => header.name).filter(Boolean).join(", ")

  function set(index: number, change: Partial<Header>) {
    onChange(headers.map((header, at) => (at === index ? { ...header, ...change } : header)))
  }

  return (
    <>
      <Property icon={KeyRoundIcon} label="Headers">
        <Edit value={names || "None"} invalid={!!error}>
          <div className="flex w-[min(24rem,calc(100vw-4rem))] flex-col gap-2">
            {headers.map((header, index) => (
              <div key={index} className="flex gap-2">
                <Input value={header.name} disabled={header.saved} onChange={(event) => set(index, { name: event.target.value })} placeholder="Name" aria-label="Header name" autoComplete="off" spellCheck={false} className="font-mono" />
                <Input value={header.value} onChange={(event) => set(index, { value: event.target.value })} placeholder={header.saved ? "••••••••" : "Value"} aria-label={`${header.name || "Header"} value`} autoComplete="off" spellCheck={false} className="font-mono" />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(headers.filter((_, at) => at !== index))} aria-label={`Remove ${header.name || "header"}`}>
                  <XIcon />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => onChange([...headers, { name: "", value: "", saved: false }])} className="self-start">
              <PlusIcon data-icon="inline-start" />
              Add header
            </Button>
            <FieldDescription>Sent with every request. Saved values stay hidden. Type a new value to replace one.</FieldDescription>
          </div>
        </Edit>
      </Property>
      {error && <FieldError className="ps-36">{error}</FieldError>}
    </>
  )
}

function tools(count: number) {
  if (count === 1) return "1 tool"
  return `${count} tools`
}
