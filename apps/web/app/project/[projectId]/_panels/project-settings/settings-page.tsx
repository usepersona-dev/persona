"use client"

import { EllipsisIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller } from "react-hook-form"

import { PicturePicker } from "@/components/picture-picker"
import { ProjectAvatar } from "@/components/project-avatar"
import { ScreenGroup } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useRemoveProject, type Project } from "@/hooks/projects"

import { useSettingsForm } from "./use-settings-form"

// The project's picture, name and description, after GitHub, with Delete in the header's menu: one part with a label, its fields one under the other in a card, and Save under the card.
// The picture is its own upload button and saves as soon as you pick a file; the name and description wait for Save.
// Delete asks first, and the project's name, typed, unlocks it. Once deleted, the front door (/) opens another project or New project.
export function SettingsPage({ project }: { project: Project }) {
  const router = useRouter()
  const { form, name, changePicture, removePicture, submit } = useSettingsForm(project)
  const [uploading, startUploading] = useTransition()
  const [removing, startRemoving] = useTransition()
  const remove = useRemoveProject()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const saving = form.formState.isSubmitting

  function changeConfirming(open: boolean) {
    setConfirming(open)
    if (!open) setTyped("")
  }

  async function deleteProject() {
    await remove.trigger(project.id, {
      onSuccess: () => {
        toast.add({ title: `Deleted “${project.name}”`, type: "success" })
        router.replace("/")
      },
    })
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Settings</SectionTitle>
        <SectionDescription>The project&apos;s picture, name and description.</SectionDescription>
        <SectionAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
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
                    picture={<ProjectAvatar name={name.trim() || project.name} imageUrl={project.imageUrl} className="size-full rounded-[inherit]" />}
                    className="rounded-xl"
                    cover={project.imageUrl ? "Replace" : "Upload"}
                    label={project.imageUrl ? "Replace picture" : "Upload a picture"}
                    note={project.imageUrl ? "Select the picture to replace it." : "Made from the name. Select the picture to upload your own."}
                    uploading={uploading}
                    removing={removing}
                    onPick={(file) => startUploading(() => changePicture(file))}
                    onRemove={project.imageUrl ? () => startRemoving(removePicture) : undefined}
                  />
                </Field>
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="project-name">Name</FieldLabel>
                      <Input {...field} id="project-name" aria-invalid={fieldState.invalid} autoComplete="off" />
                      {!fieldState.invalid && <FieldDescription>{project.imageUrl ? "The picture stays when the name changes." : "The picture changes with the name until you upload one."}</FieldDescription>}
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="description"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="project-description">Description</FieldLabel>
                      <Textarea {...field} id="project-description" rows={2} aria-invalid={fieldState.invalid} />
                      {!fieldState.invalid && <FieldDescription>Optional.</FieldDescription>}
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
      <AlertDialog open={confirming} onOpenChange={changeConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone. Its personas go too, with their chats, files and automations, and its own numbers and bots stop answering.</AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="confirm-project">
              <span>
                Type <strong className="font-semibold">{project.name}</strong> to confirm
              </span>
            </FieldLabel>
            <Input id="confirm-project" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={project.name} autoComplete="off" spellCheck={false} />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={typed.trim() !== project.name || remove.isMutating} onClick={deleteProject}>
              {remove.isMutating && <Spinner data-icon="inline-start" />}
              {remove.isMutating ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}
