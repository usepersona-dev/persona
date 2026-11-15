import { useAction } from "@/hooks/use-action"
import { request } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as organizations from "@/usecases/organizations"

export type Invitation = Output<typeof organizations.inviteMember>
export type InviteInput = Parameters<typeof organizations.inviteMember>[1]

export function useInviteMember() {
  const key = "/api/invitations"
  const invite = useAction(key, (input: InviteInput) => request<Invitation>("POST", key, input))
  return invite
}
