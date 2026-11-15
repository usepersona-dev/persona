"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

import { AuthDescription, AuthHeader, AuthPending, AuthScreen, AuthTitle } from "../../_components/auth-layout"
import { useOpenOrganization } from "../_hooks/use-open-organization"
import { useOrganizationChoices } from "../_hooks/use-organization-choices"
import { CreateOrganization } from "./create-organization"
import { OrganizationList, OrganizationListError, OrganizationListLoading } from "./organization-list"

// Open one of your organizations, join an invite, or create one. A pending session does this first; an active one comes here to switch. With nothing to pick, the step starts at create.
// While an organization opens, the whole step waits on one screen until the app shows.
// The heading is static, so it renders for real while the list loads.
export function ChooseOrganization() {
  const choices = useOrganizationChoices()
  const { opening, failure, open, join, create } = useOpenOrganization()
  const [creating, setCreating] = useState(false)
  const createError = failure?.target === "create" ? failure.message : undefined

  if (opening) return <AuthPending art="/art/team.webp" title="Opening your organization" description="One moment." />
  if (choices.status === "empty") return <CreateOrganization onCreate={create} error={createError} />
  if (creating) return <CreateOrganization onBack={() => setCreating(false)} onCreate={create} error={createError} />

  return (
    <AuthScreen art="/art/team.webp">
      <AuthHeader>
        <AuthTitle>Choose an organization</AuthTitle>
        <AuthDescription>Pick the one you want to work in.</AuthDescription>
      </AuthHeader>
      {choices.status === "loading" && <OrganizationListLoading />}
      {choices.status === "error" && <OrganizationListError error={choices.error} />}
      {choices.status === "ready" && <OrganizationList memberships={choices.memberships} invitations={choices.invitations} failure={failure} onOpen={open} onJoin={join} />}
      <Button variant="outline" size="lg" className="w-full" disabled={choices.status === "loading"} onClick={() => setCreating(true)}>
        <PlusIcon />
        Create organization
      </Button>
    </AuthScreen>
  )
}
