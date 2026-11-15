import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import { z } from "zod"

import { inviteToOrganization } from "@/lib/clerk"
import { err, ok, validate } from "@/lib/errors"
import type { Caller } from "@/usecases/auth"

const inviteInput = z.object({ email: z.email("Enter an email address.") })

/** Invites someone to the caller's organization by email. The email's link opens our sign-in page with Clerk's ticket: Clerk's card signs them up or in with it, and that joins them to the organization. */
export async function inviteMember(caller: Caller, input: z.input<typeof inviteInput>) {
  const parsed = validate(inviteInput, input)
  if (!parsed.ok) return parsed
  const { email } = parsed.value

  const redirectUrl = new URL("/sign-in", process.env.APP_URL).toString()
  const invitation = await sendInvitation({ orgId: caller.orgId, inviterId: caller.userId, email, redirectUrl })
  return invitation
}

// Clerk refuses an invite it can't send, such as one to someone already in the organization, with a message the inviter can read
async function sendInvitation(invite: Parameters<typeof inviteToOrganization>[0]) {
  try {
    const invitation = await inviteToOrganization(invite)
    return ok(invitation)
  } catch (error) {
    if (!isClerkAPIResponseError(error) || error.status >= 500) throw error
    const message = error.errors[0]?.longMessage ?? error.errors[0]?.message ?? "Clerk did not take that invite."
    return err("invalid", message)
  }
}
