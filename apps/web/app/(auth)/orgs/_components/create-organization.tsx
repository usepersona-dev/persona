"use client"

import type { SubmitEvent } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { AuthDescription, AuthFooter, AuthFooterButton, AuthHeader, AuthScreen, AuthTitle } from "../../_components/auth-layout"

// `onBack` returns to the list when there is one to return to.
// The page creates the organization and opens it; a failure comes back as `error`.
export function CreateOrganization({ onBack, onCreate, error }: { onBack?: () => void; onCreate: (name: string) => void; error?: string }) {
  function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = new FormData(event.currentTarget).get("name") as string
    onCreate(name)
  }

  return (
    <AuthScreen art="/art/team.webp">
      <AuthHeader>
        <AuthTitle>Create an organization</AuthTitle>
        <AuthDescription>A home for your projects and the people you work with.</AuthDescription>
      </AuthHeader>
      <form onSubmit={create} className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" name="name" placeholder="Your studio or brand" autoComplete="organization" required />
          <FieldError>{error}</FieldError>
        </Field>
        <Button type="submit" size="lg" className="w-full">
          Create organization
        </Button>
      </form>
      {onBack && (
        <AuthFooter>
          <AuthFooterButton onClick={onBack}>Back to your organizations</AuthFooterButton>
        </AuthFooter>
      )}
    </AuthScreen>
  )
}
