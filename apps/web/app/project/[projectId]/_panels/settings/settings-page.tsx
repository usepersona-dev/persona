"use client"

import { CopyPlusIcon, EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { Controller } from "react-hook-form"

import { PicturePicker } from "@/components/picture-picker"
import { PersonaAvatar } from "@/components/persona-avatar"
import { ScreenGroup } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useRemovePersona, type Persona } from "@/hooks/personas"

import { usePanels } from "../../_hooks/use-panels"
import { useSettingsForm } from "./use-settings-form"

// The persona's picture and name, after GitHub, with Delete in the header's menu: one part with a label, its fields one under the other in a card, and Save under the card.
// The picture is its own upload button and saves as soon as you pick a file; the name waits for Save. Delete asks first, with a plain confirm, and the panel closes once the persona is gone.
export function SettingsPage({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { form, name, changePicture, removePicture, submit } = useSettingsForm(persona)
  const [uploading, startUploading] = useTransition()
  const [removing, startRemoving] = useTransition()
  const remove = useRemovePersona(persona.projectId)
  const [confirming, setConfirming] = useState(false)
  const saving = form.formState.isSubmitting

  function deletePersona() {
    void remove.trigger(persona.id, {
      onSuccess: () => {
        setConfirming(false)
        panels.close()
        toast.add({ title: "Persona deleted", type: "success" })
      },
    })
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Settings</SectionTitle>
        <SectionDescription>
          The name and picture of <span className="font-semibold text-foreground">{persona.name}</span>.
        </SectionDescription>
        <SectionAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem onClick={() => panels.openDuplicate(persona.id)}>
                <CopyPlusIcon />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SectionAction>
      </SectionHeader>
      <ScreenGroup title="General">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Card>
            <CardContent>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldTitle>Picture</FieldTitle>
                  <PicturePicker
                    picture={<PersonaAvatar name={name.trim() || persona.name} imageUrl={persona.imageUrl} className="size-full rounded-[inherit]" />}
                    className="rounded-2xl"
                    cover={persona.imageUrl ? "Replace" : "Upload"}
                    label={persona.imageUrl ? "Replace picture" : "Upload a picture"}
                    note={persona.imageUrl ? "Select the picture to replace it." : "Made from the name. Select the face to upload a picture."}
                    uploading={uploading}
                    removing={removing}
                    onPick={(file) => startUploading(() => changePicture(file))}
                    onRemove={persona.imageUrl ? () => startRemoving(removePicture) : undefined}
                  />
                </Field>
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="persona-name">Name</FieldLabel>
                      <Input {...field} id="persona-name" aria-invalid={fieldState.invalid} autoComplete="off" />
                      {!fieldState.invalid && <FieldDescription>{persona.imageUrl ? "The picture stays when the name changes." : "The face changes with the name."}</FieldDescription>}
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </FieldGroup>
            </CardContent>
          </Card>
          <Button type="submit" className="self-end" disabled={saving || !form.formState.isDirty}>
            {saving && <Spinner data-icon="inline-start" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </ScreenGroup>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this persona?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone. The chats, files, automations and connected apps are deleted too.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={remove.isMutating} onClick={deletePersona}>
              {remove.isMutating && <Spinner data-icon="inline-start" />}
              {remove.isMutating ? "Deleting…" : "Delete persona"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}
