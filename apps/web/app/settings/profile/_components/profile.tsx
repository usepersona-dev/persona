"use client"

import { useUser } from "@clerk/nextjs"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import type { UserResource } from "@clerk/nextjs/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { BadgeCheckIcon } from "lucide-react"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { PicturePicker } from "@/components/picture-picker"
import { ScreenDescription, ScreenGroup, ScreenHeader, ScreenTitle } from "@/components/screen"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" })
const DATE_TIME = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" })

const Schema = z.object({ firstName: z.string().trim(), lastName: z.string().trim() })

type Values = z.infer<typeof Schema>

// The signed-in person, as Clerk keeps them, after GitHub: one part with a label, its fields one under the other in a card, and Save under the card.
// The photo is its own upload button and saves as soon as you pick a file; the names wait for Save.
export function Profile() {
  const { user } = useUser()

  return (
    <>
      <ScreenHeader>
        <ScreenTitle>Profile</ScreenTitle>
        <ScreenDescription>Your name, email and photo, synced from how you sign in.</ScreenDescription>
      </ScreenHeader>
      {user ? (
        <ProfileForm user={user} />
      ) : (
        <div aria-hidden className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <div className="flex flex-col gap-5">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex flex-col gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function ProfileForm({ user }: { user: UserResource }) {
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { firstName: user.firstName ?? "", lastName: user.lastName ?? "" } })
  const [uploading, startUploading] = useTransition()
  const [removing, startRemoving] = useTransition()

  const email = user.primaryEmailAddress
  const name = user.fullName ?? email?.emailAddress ?? ""
  const saving = form.formState.isSubmitting
  const providers = user.externalAccounts.map((account) => account.providerTitle()).join(", ")
  const facts = [providers && `Signed in with ${providers}.`, user.createdAt && `Member since ${DATE.format(user.createdAt)}.`, user.lastSignInAt && `Last sign-in ${DATE_TIME.format(user.lastSignInAt)}.`].filter(Boolean).join(" ")

  async function save(values: Values) {
    try {
      await user.update({ firstName: values.firstName, lastName: values.lastName })
      form.reset(values)
      toast.add({ title: "Profile updated", type: "success" })
    } catch (failure) {
      toast.add({ title: failureMessage(failure), type: "error" })
    }
  }

  function upload(file: File) {
    startUploading(async () => {
      try {
        await user.setProfileImage({ file })
        toast.add({ title: "Photo updated", type: "success" })
      } catch (failure) {
        toast.add({ title: failureMessage(failure), type: "error" })
      }
    })
  }

  function remove() {
    startRemoving(async () => {
      try {
        await user.setProfileImage({ file: null })
        toast.add({ title: "Photo removed", type: "success" })
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
                <FieldTitle>Profile photo</FieldTitle>
                <PicturePicker
                  picture={
                    user.hasImage ? (
                      <Avatar className="size-full rounded-[inherit]">
                        <AvatarImage src={user.imageUrl} alt="" />
                        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ) : undefined
                  }
                  className="rounded-full"
                  cover="Replace"
                  label={user.hasImage ? "Replace photo" : "Upload a photo"}
                  note={user.hasImage ? "Select the photo to replace it." : "Select the circle to upload a photo."}
                  uploading={uploading}
                  removing={removing}
                  onPick={upload}
                  onRemove={user.hasImage ? remove : undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="first-name">First name</FieldLabel>
                <Input {...form.register("firstName")} id="first-name" autoComplete="given-name" />
                <FieldDescription>Your team sees this name.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                <Input {...form.register("lastName")} id="last-name" autoComplete="family-name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="email" value={email?.emailAddress ?? ""} readOnly disabled />
                  {email?.verification.status === "verified" && (
                    <InputGroupAddon align="inline-end">
                      <BadgeCheckIcon role="img" aria-label="Verified" />
                    </InputGroupAddon>
                  )}
                </InputGroup>
                {facts && <FieldDescription>{facts}</FieldDescription>}
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
