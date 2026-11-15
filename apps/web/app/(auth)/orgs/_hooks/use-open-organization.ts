"use client"

import { useClerk } from "@clerk/nextjs"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import type { UserOrganizationInvitationResource } from "@clerk/nextjs/types"
import { useState } from "react"

// Opens an organization: makes it the active one, which finishes the session's choose-organization task, then opens the app.
// The state lives above the list, because while Clerk switches the organization it reports the lists as not loaded and the rows unmount.
// A failure carries its target, so its message shows in the right place: the organization's id, the invitation's id, or "create".
// The app opens after setActive, not from its navigate option: for a pending session Clerk skips that option and goes to the taskUrls page, /orgs.
// Not in a startTransition: Clerk's navigation runs in its own transition and waits for it, and React holds every transition until a running async one ends, so they would wait on each other.
export function useOpenOrganization() {
  const clerk = useClerk()
  const [opening, setOpening] = useState(false)
  const [failure, setFailure] = useState<{ target: string; message: string }>()

  async function openOrganization(target: string, resolveOrganizationId: () => Promise<string>) {
    setFailure(undefined)
    setOpening(true)
    try {
      const organizationId = await resolveOrganizationId()
      await clerk.setActive({ organization: organizationId })
      await clerk.navigate("/")
    } catch (error) {
      const message = isClerkAPIResponseError(error) ? error.errors[0]?.longMessage : undefined
      setFailure({ target, message: message ?? "That didn't work." })
      setOpening(false)
    }
  }

  async function open(organizationId: string) {
    await openOrganization(organizationId, async () => organizationId)
  }

  async function join(invitation: UserOrganizationInvitationResource) {
    await openOrganization(invitation.id, async () => {
      await invitation.accept()
      return invitation.publicOrganizationData.id
    })
  }

  async function create(name: string) {
    await openOrganization("create", async () => {
      const organization = await clerk.createOrganization({ name })
      return organization.id
    })
  }

  return { opening, failure, open, join, create }
}
