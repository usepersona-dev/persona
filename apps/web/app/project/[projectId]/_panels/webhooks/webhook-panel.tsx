"use client"

import { CopyIcon, LinkIcon, SendIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { Choose, Property } from "@/components/property"
import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import type { Persona } from "@/hooks/personas"
import type { Webhook } from "@/hooks/webhooks"

import { useWebhookForm } from "./use-webhook-form"

export function WebhookPanel({ persona, webhook, open, onOpenChange, onCreated }: { persona: Persona; webhook: Webhook | null; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (webhookId: string) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <WebhookForm key={webhook?.id ?? "new"} persona={persona} webhook={webhook} onCreated={onCreated} onClose={() => onOpenChange(false)} />
    </SidePanel>
  )
}

// Inside the panel, so the form starts fresh each time the panel opens, and again when Create turns it into the new webhook
function WebhookForm({ persona, webhook, onCreated, onClose }: { persona: Persona; webhook: Webhook | null; onCreated: (webhookId: string) => void; onClose: () => void }) {
  const { form, submit, saving, deleting, confirming, setConfirming, deleteWebhook, chats } = useWebhookForm(persona, webhook, onCreated, onClose)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{webhook?.name ?? "New webhook"}</SidePanelTitle>
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
                  <input {...field} aria-label="Name" aria-invalid={fieldState.invalid} placeholder="Untitled webhook" autoComplete="off" className="w-full bg-transparent font-heading text-4xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex flex-col gap-1">
              <Property icon={LinkIcon} label="Address">
                {webhook ? <Address url={webhook.url} /> : <span className="px-3 text-sm text-muted-foreground">Shows after Create</span>}
              </Property>
              <Controller
                control={form.control}
                name="linkId"
                render={({ field }) => (
                  <Property icon={SendIcon} label="Send to">
                    <Choose items={chats} value={field.value} onChange={field.onChange} />
                  </Property>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="prompt"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="webhook-prompt">What to do</FieldLabel>
                  <Textarea {...field} id="webhook-prompt" aria-invalid={fieldState.invalid} placeholder="Describe the whole task, step by step. Each call's body comes with it as a file." className="max-h-[50dvh] min-h-56 rounded-[10px] bg-card px-4 leading-7 md:text-base" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex justify-end gap-2">
              {webhook && (
                <Button type="button" variant="destructive" className="me-auto" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {webhook ? (saving ? "Saving…" : "Save") : saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Section>
      </SidePanelBody>
      {webhook && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{webhook.name}”?</AlertDialogTitle>
              <AlertDialogDescription>Calls to its address stop working for good. To stop it for a while, pause it instead.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteWebhook}>
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

// The address, with a button that copies it
function Address({ url }: { url: string }) {
  return (
    <span className="flex max-w-full min-w-0 items-center gap-1 ps-3">
      <span className="truncate font-mono text-sm">{url}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Copy the address" title="Copy the address" onClick={() => void copy(url)}>
        <CopyIcon />
      </Button>
    </span>
  )
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    toast.add({ title: "Copy did not work", description: "Select the address and copy it.", type: "error" })
    return
  }

  toast.add({ title: "Copied the address", type: "success" })
}
