"use client"

import { useAuth } from "@clerk/nextjs"
import type { ClerkAPIResponseError } from "@clerk/nextjs/errors"
import type { OrganizationMembershipResource, OrganizationResource, UserOrganizationInvitationResource } from "@clerk/nextjs/types"
import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// The active organization wears a "Current" badge. A pending session has none yet.
// The page opens and joins; a failed one comes back as `failure`, and its message shows on the row it belongs to.
export function OrganizationList({ memberships, invitations, failure, onOpen, onJoin }: { memberships: OrganizationMembershipResource[]; invitations: UserOrganizationInvitationResource[]; failure?: { target: string; message: string }; onOpen: (organizationId: string) => void; onJoin: (invitation: UserOrganizationInvitationResource) => void }) {
  const { orgId } = useAuth()

  return (
    <ItemGroup className="gap-2.5">
      {memberships.map((membership) => (
        <MembershipRow key={membership.id} membership={membership} current={membership.organization.id === orgId} error={failure?.target === membership.organization.id ? failure.message : undefined} onOpen={onOpen} />
      ))}
      {invitations.map((invitation) => (
        <InvitationRow key={invitation.id} invitation={invitation} error={failure?.target === invitation.id ? failure.message : undefined} onJoin={onJoin} />
      ))}
    </ItemGroup>
  )
}

// The whole row opens the organization. If that fails, Clerk's message shows under the name.
function MembershipRow({ membership, current, error, onOpen }: { membership: OrganizationMembershipResource; current: boolean; error?: string; onOpen: (organizationId: string) => void }) {
  const organization = membership.organization

  return (
    <Item variant="outline" className="bg-card text-start hover:border-foreground/20" render={<button type="button" onClick={() => onOpen(organization.id)} />}>
      <OrganizationMark organization={organization} />
      <ItemContent>
        <ItemTitle className="text-[15px] font-bold">
          {organization.name}
          {current && <Badge>Current</Badge>}
        </ItemTitle>
        {error && <ItemDescription className="text-destructive">{error}</ItemDescription>}
      </ItemContent>
      <ItemActions>
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
  )
}

// Joining accepts the invitation, then opens the organization the same way a row above does
function InvitationRow({ invitation, error, onJoin }: { invitation: UserOrganizationInvitationResource; error?: string; onJoin: (invitation: UserOrganizationInvitationResource) => void }) {
  const organization = invitation.publicOrganizationData

  return (
    <Item variant="outline" className="bg-card">
      <OrganizationMark organization={organization} />
      <ItemContent>
        <ItemTitle className="text-[15px] font-bold">{organization.name}</ItemTitle>
        <ItemDescription className={cn(error && "text-destructive")}>{error ?? "Invited you to join"}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline" onClick={() => onJoin(invitation)}>
          Join
        </Button>
      </ItemActions>
    </Item>
  )
}

// Placeholder rows shaped like the list, so the step keeps its height while the lists load
export function OrganizationListLoading({ rows = 2 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-[70px] rounded-md" />
      ))}
    </div>
  )
}

// Shows in place of the list, with Clerk's own words for what went wrong
export function OrganizationListError({ error }: { error: ClerkAPIResponseError }) {
  return (
    <Empty className="rounded-xl border bg-card p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Your organizations did not load</EmptyTitle>
        <EmptyDescription>{error.errors[0]?.longMessage ?? error.message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// Clerk's logo for the organization, or its default building icon when none was uploaded
function OrganizationMark({ organization }: { organization: Pick<OrganizationResource, "name" | "imageUrl"> }) {
  const initials = organization.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()

  return (
    <ItemMedia>
      <Avatar className="size-9 rounded-md">
        <AvatarImage src={organization.imageUrl} alt="" />
        <AvatarFallback className="bg-secondary font-bold text-secondary-foreground">{initials}</AvatarFallback>
      </Avatar>
    </ItemMedia>
  )
}
