"use client"

import { useClerk } from "@clerk/nextjs"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { ProjectAvatar } from "@/components/project-avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useCreateProject } from "@/hooks/projects"
import { useUpload } from "@/hooks/uploads"

import { AuthDescription, AuthFooter, AuthFooterButton, AuthFooterLink, AuthHeader, AuthScreen, AuthTitle } from "../../../_components/auth-layout"

const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

// The server checks the same rules
const Schema = z.object({
  name: z.string().trim().min(1, "Give the project a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters."),
  picture: z.instanceof(File).refine((file) => PICTURE_TYPES.includes(file.type), "Pick a PNG, JPG, WebP or GIF picture.").refine((file) => file.size <= 2 * 1024 * 1024, "Pictures can be up to 2 MB.").optional(),
})

type Values = z.infer<typeof Schema>

// An organization with no project lands here first, so its way out is to sign out. With projects, `back` names one to return to.
// A picked picture uploads first and its URL goes in with the project, which also creates its first persona. Then the app opens.
export function NewProjectForm({ back }: { back?: string }) {
  const router = useRouter()
  const clerk = useClerk()
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: "", description: "", picture: undefined } })
  const picture = useWatch({ control: form.control, name: "picture" })
  const preview = useMemo(() => (picture ? URL.createObjectURL(picture) : null), [picture])
  const create = useCreateProject()
  const upload = useUpload()
  const [signingOut, setSigningOut] = useState(false)
  const creating = upload.isMutating || create.isMutating || !!create.data

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  async function submit(values: Values) {
    const imageUrl = values.picture ? await upload.trigger(values.picture) : undefined
    if (values.picture && !imageUrl) return
    
    const created = await create.trigger({ name: values.name, description: values.description, imageUrl })
    if (!created) return

    toast.add({ title: `Created “${created.project.name}”`, type: "success" })
    router.push(`/project/${created.project.id}`)
  }

  async function signOut() {
    setSigningOut(true)
    await clerk.signOut({ redirectUrl: "/sign-in" })
  }

  return (
    <AuthScreen art="/art/build.webp">
      <AuthHeader>
        <AuthTitle>New project</AuthTitle>
        <AuthDescription>A project holds your personas, what they know and where they answer.</AuthDescription>
      </AuthHeader>
      <form onSubmit={form.handleSubmit(submit)}>
        <FieldGroup className="gap-5">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || !!form.formState.errors.picture}>
                <FieldLabel htmlFor="project-name">Name</FieldLabel>
                <div className="flex items-center gap-2.5">
                  <label className="group/picture relative shrink-0 cursor-pointer overflow-hidden rounded-md">
                    <ProjectAvatar name={field.value.trim() || "New project"} imageUrl={preview} className="size-9" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover/picture:opacity-100 group-has-[:focus-visible]/picture:opacity-100">
                      <PlusIcon className="size-4" />
                    </span>
                    <input type="file" accept={PICTURE_TYPES.join(",")} aria-label="Upload a picture" className="sr-only" onChange={(event) => form.setValue("picture", event.target.files?.[0], { shouldValidate: true })} />
                  </label>
                  <Input {...field} id="project-name" aria-invalid={fieldState.invalid} autoComplete="off" />
                </div>
                <FieldDescription>Tap the picture to upload your own. You can rename it later.</FieldDescription>
                <FieldError errors={[fieldState.error, form.formState.errors.picture]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="project-description">Description</FieldLabel>
                <Textarea {...field} id="project-description" aria-invalid={fieldState.invalid} rows={3} placeholder="What's this project for?" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Button type="submit" size="lg" className="w-full" disabled={creating}>
            {creating && <Spinner data-icon="inline-start" />}
            {creating ? "Creating…" : "Create project"}
          </Button>
        </FieldGroup>
      </form>
      <AuthFooter>
        {back ? (
          <>
            Changed your mind?{" "}
            <AuthFooterLink href="/">Back to {back}</AuthFooterLink>
          </>
        ) : (
          <>
            Wrong account?{" "}
            <AuthFooterButton disabled={signingOut} onClick={signOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </AuthFooterButton>
          </>
        )}
      </AuthFooter>
    </AuthScreen>
  )
}
