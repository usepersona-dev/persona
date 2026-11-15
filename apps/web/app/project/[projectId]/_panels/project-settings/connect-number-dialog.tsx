"use client"

import { Controller, type Control } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

import { useConnectNumberForm, type ConnectNumberValues } from "./use-connect-number-form"

// Bring your number: a WhatsApp number in the person's own Meta account, answered through their own Meta app
export function ConnectNumberDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ConnectNumber projectId={projectId} onConnected={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

// Inside the dialog, so the form starts empty each time it opens. The fields go in the order Meta's pages show them: the number's two IDs side by side on the app's WhatsApp > API Setup page, the app's ID and secret on App settings > Basic, then the system user's token
function ConnectNumber({ projectId, onConnected }: { projectId: string; onConnected: () => void }) {
  const { form, connecting, submit } = useConnectNumberForm(projectId, onConnected)

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle>Bring your number</DialogTitle>
        <DialogDescription>A WhatsApp number in your own Meta account.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <KeyField control={form.control} name="phoneNumberId" label="Phone number ID" description="On your app's WhatsApp > API Setup page." />
          <KeyField control={form.control} name="wabaId" label="Messaging account ID" description="Next to the phone number ID." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <KeyField control={form.control} name="appId" label="App ID" description="At the top of your app's dashboard." />
          <KeyField control={form.control} name="appSecret" label="App secret" description="Under App settings > Basic." />
        </div>
        <KeyField control={form.control} name="accessToken" label="Access token" description="A system user's token for this app, with WhatsApp permissions." />
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />} disabled={connecting}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={connecting}>
          {connecting && <Spinner data-icon="inline-start" />}
          {connecting ? "Testing…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}

// One key: its label, where to find it, and its error once the field is wrong
function KeyField({ control, name, label, description }: { control: Control<ConnectNumberValues>; name: keyof ConnectNumberValues; label: string; description: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`connect-${name}`}>{label}</FieldLabel>
          <Input {...field} id={`connect-${name}`} aria-invalid={fieldState.invalid} autoComplete="off" spellCheck={false} className="font-mono" />
          {!fieldState.invalid && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
