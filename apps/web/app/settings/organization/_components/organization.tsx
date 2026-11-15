"use client"

import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import type { OrganizationInvitationResource, OrganizationMembershipResource } from "@clerk/nextjs/types"
import { CloudOffIcon, MailIcon, MoreHorizontalIcon, Trash2Icon, UserMinusIcon } from "lucide-react"
import { useState, useTransition } from "react"

import { ScreenActions, ScreenDescription, ScreenEmpty, ScreenGroup, ScreenHeader, ScreenRow, ScreenRows, ScreenTitle } from "@/components/screen"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

import { useOrganizationTeam } from "../_hooks/use-organization-team"
import { InviteDialog } from "./invite-dialog"
import { OrganizationForm } from "./organization-form"

export function Organization() {
  const team = useOrganizationTeam()

  return (
    <>
      <ScreenHeader>
        <ScreenTitle>Organization</ScreenTitle>
        <ScreenDescription>Your organization&apos;s details, team and invitations.</ScreenDescription>
        <ScreenActions>
          <InviteDialog organization={team.status === "ready" ? team.organization : undefined} onInvited={team.status === "ready" ? team.reloadInvitations : undefined} />
        </ScreenActions>
      </ScreenHeader>
      {team.status === "loading" && (
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
      {team.status === "error" && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>Your team did not load</EmptyTitle>
            <EmptyDescription>{team.error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {team.status === "ready" && (
        <>
          <OrganizationForm organization={team.organization} />
          <ScreenGroup title="Team" count={team.members.length}>
            <ScreenRows>
              {team.members.map((member) => (
                <MemberRow key={member.id} member={member} you={member.id === team.me.id} onChange={team.reloadMembers} />
              ))}
            </ScreenRows>
          </ScreenGroup>
          {team.invitations.length > 0 && (
            <ScreenGroup title="Invited" count={team.invitations.length}>
              <ScreenRows>
                {team.invitations.map((invitation) => (
                  <InvitationRow key={invitation.id} invitation={invitation} onChange={team.reloadInvitations} />
                ))}
              </ScreenRows>
            </ScreenGroup>
          )}
        </>
      )}
    </>
  )
}

// You cannot remove yourself here
function MemberRow({ member, you, onChange }: { member: OrganizationMembershipResource; you: boolean; onChange: () => Promise<unknown> }) {
  const [removing, startRemoving] = useTransition()
  const [confirming, setConfirming] = useState(false)

  const person = member.publicUserData
  const email = person?.identifier ?? ""
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(" ") || email

  function remove() {
    startRemoving(async () => {
      try {
        await member.destroy()
        await onChange()
        setConfirming(false)
        toast.add({ title: `Removed ${name}`, type: "success" })
      } catch (failure) {
        toast.add({ title: failureMessage(failure), type: "error" })
      }
    })
  }

  return (
    <ScreenRow>
      <ItemMedia>
        <Avatar>
          <AvatarImage src={person?.hasImage ? person.imageUrl : undefined} alt="" />
          <AvatarFallback className="font-bold">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {name}
          {you && <span className="text-xs font-semibold text-muted-foreground">(you)</span>}
        </ItemTitle>
        <ItemDescription>{email}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {you ? (
          <span className="size-8" />
        ) : (
          <>
            <RowMenu label="Remove member" icon={<UserMinusIcon />} onSelect={() => setConfirming(true)} />
            <Confirm open={confirming} onOpenChange={setConfirming} busy={removing} title={`Remove ${name}?`} description="They lose access to every project in this organization. You can invite them back later." action="Remove member" busyAction="Removing…" onConfirm={remove} />
          </>
        )}
      </ItemActions>
    </ScreenRow>
  )
}

function InvitationRow({ invitation, onChange }: { invitation: OrganizationInvitationResource; onChange: () => Promise<unknown> }) {
  const [revoking, startRevoking] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function revoke() {
    startRevoking(async () => {
      try {
        await invitation.revoke()
        await onChange()
        setConfirming(false)
        toast.add({ title: `Revoked the invite for ${invitation.emailAddress}`, type: "success" })
      } catch (failure) {
        toast.add({ title: failureMessage(failure), type: "error" })
      }
    })
  }

  return (
    <ScreenRow>
      <ItemMedia>
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <MailIcon className="size-4" />
        </span>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{invitation.emailAddress}</ItemTitle>
        <ItemDescription>Waiting for them to join</ItemDescription>
      </ItemContent>
      <ItemActions>
        <RowMenu label="Revoke invite" icon={<Trash2Icon />} onSelect={() => setConfirming(true)} />
        <Confirm open={confirming} onOpenChange={setConfirming} busy={revoking} title={`Revoke the invite for ${invitation.emailAddress}?`} description="Their link stops working right away. You can send a fresh invite any time." action="Revoke invite" busyAction="Revoking…" onConfirm={revoke} />
      </ItemActions>
    </ScreenRow>
  )
}

function RowMenu({ label, icon, onSelect }: { label: string; icon: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={onSelect}>
          {icon}
          {label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Stays open, its button busy, until the action finishes
function Confirm({ open, onOpenChange, busy, title, description, action, busyAction, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; title: string; description: string; action: string; busyAction: string; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? busyAction : action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function failureMessage(failure: unknown) {
  const message = isClerkAPIResponseError(failure) ? failure.errors[0]?.longMessage : undefined
  return message ?? "That didn't work."
}
