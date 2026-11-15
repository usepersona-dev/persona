"use client"

import { useOrganizationList } from "@clerk/nextjs"

// The session's organizations and invitations as one state: loading, failed, empty or ready. Not a bag of booleans.
// Clerk types both lists as "maybe empty defaults" until it loads, so the narrowing on isLoaded happens here, once.
export function useOrganizationChoices() {
  const organizations = useOrganizationList({ userMemberships: true, userInvitations: true })
  if (!organizations.isLoaded) return { status: "loading" } as const

  const { userMemberships, userInvitations } = organizations
  if (userMemberships.isLoading || userInvitations.isLoading) return { status: "loading" } as const

  const error = userMemberships.error ?? userInvitations.error
  if (error) return { status: "error", error } as const

  if (userMemberships.count === 0 && userInvitations.count === 0) return { status: "empty" } as const

  return { status: "ready", memberships: userMemberships.data, invitations: userInvitations.data } as const
}
