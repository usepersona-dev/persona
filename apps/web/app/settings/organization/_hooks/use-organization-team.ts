"use client"

import { useOrganization } from "@clerk/nextjs"

// The active organization with its members and pending invitations, as one state: loading, failed or ready.
// Clerk types the lists as maybe-empty defaults until your membership loads, so the narrowing happens here, once.
export function useOrganizationTeam() {
  const { organization, membership, memberships, invitations } = useOrganization({
    memberships: { pageSize: 50, keepPreviousData: true },
    invitations: { status: ["pending"], pageSize: 50, keepPreviousData: true },
  })
  if (!organization || !membership || !memberships || !invitations) return { status: "loading" } as const
  if (memberships.isLoading || invitations.isLoading) return { status: "loading" } as const

  const error = memberships.error ?? invitations.error
  if (error) return { status: "error", error } as const

  return {
    status: "ready",
    organization,
    me: membership,
    members: memberships.data,
    invitations: invitations.data,
    reloadMembers: memberships.revalidate,
    reloadInvitations: invitations.revalidate,
  } as const
}
