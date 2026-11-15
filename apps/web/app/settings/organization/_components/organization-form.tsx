"use client"

import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import type { OrganizationResource } from "@clerk/nextjs/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { PicturePicker } from "@/components/picture-picker"
import { ScreenGroup } from "@/components/screen"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

const Schema = z.object({
  name: z.string().trim().min(1, "Give the organization a name."),
  slug: z.string().trim().regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes."),
})

type Values = z.infer<typeof Schema>

// The organization's details, as Clerk keeps them, after GitHub: one part with a label, its fields one under the other in a card, and Save under the card.
// The logo is its own upload button and saves as soon as you pick a file; the name and short name wait for Save.
export function OrganizationForm({ organization }: { organization: OrganizationResource }) {
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: organization.name, slug: organization.slug ?? "" } })
  const [uploading, startUploading] = useTransition()
  const [removing, startRemoving] = useTransition()

  const saving = form.formState.isSubmitting
  const errors = form.formState.errors

  async function save(values: Values) {
    try {
      await organization.update({ name: values.name, slug: values.slug || undefined })
      form.reset(values)
      toast.add({ title: "Organization updated", type: "success" })
    } catch (failure) {
      toast.add({ title: failureMessage(failure), type: "error" })
    }
  }

  function upload(file: File) {
    startUploading(async () => {
      try {
        await organization.setLogo({ file })
        toast.add({ title: "Logo updated", type: "success" })
      } catch (failure) {
        toast.add({ title: failureMessage(failure), type: "error" })
      }
    })
  }

  function remove() {
    startRemoving(async () => {
      try {
        await organization.setLogo({ file: null })
        toast.add({ title: "Logo removed", type: "success" })
      } catch (failure) {
        toast.add({ title: failureMessage(failure), type: "error" })
      }
    })
  }

  return (
    <ScreenGroup title="General">
      <form onSubmit={form.handleSubmit(save)} className="flex flex-col gap-5">
        <Card>
          <CardContent>
            <FieldGroup className="gap-5">
              <Field>
                <FieldTitle>Logo</FieldTitle>
                <PicturePicker
                  picture={
                    organization.hasImage ? (
                      <Avatar className="size-full rounded-[inherit]">
                        <AvatarImage src={organization.imageUrl} alt="" />
                        <AvatarFallback>{organization.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ) : undefined
                  }
                  className="rounded-lg"
                  cover="Replace"
                  label={organization.hasImage ? "Replace logo" : "Upload a logo"}
                  note={organization.hasImage ? "Select the logo to replace it." : "Select the square to upload a logo."}
                  uploading={uploading}
                  removing={removing}
                  onPick={upload}
                  onRemove={organization.hasImage ? remove : undefined}
                />
              </Field>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="org-name">Name</FieldLabel>
                <Input {...form.register("name")} id="org-name" aria-invalid={!!errors.name} autoComplete="organization" />
                {!errors.name && <FieldDescription>Your team sees it, and so do the people you invite.</FieldDescription>}
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.slug}>
                <FieldLabel htmlFor="org-slug">Short name</FieldLabel>
                <Input {...form.register("slug")} id="org-slug" aria-invalid={!!errors.slug} autoComplete="off" />
                {!errors.slug && <FieldDescription>Used in links and invite codes.</FieldDescription>}
                <FieldError errors={[errors.slug]} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <Button type="submit" className="self-end" disabled={saving || !form.formState.isDirty}>
          {saving && <Spinner data-icon="inline-start" />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
    </ScreenGroup>
  )
}

function failureMessage(failure: unknown) {
  const message = isClerkAPIResponseError(failure) ? failure.errors[0]?.longMessage : undefined
  return message ?? "That didn't work."
}
