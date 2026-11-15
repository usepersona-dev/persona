import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

export const OrgRole = { admin: "org:admin", member: "org:member" } as const
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole]

export async function getUser(authId: string) {
  const clerk = await clerkClient()
  const [user, memberships] = await Promise.all([
    clerk.users.getUser(authId),
    clerk.users.getOrganizationMembershipList({ userId: authId }),
  ])

  return {
    authId,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    imageUrl: user.imageUrl ?? null,
    organizationIds: memberships.data.map((membership) => membership.organization.id),
  }
}

// Clerk emails the invite; its link opens redirectUrl. Everyone joins as an admin
export async function inviteToOrganization(invite: { orgId: string; inviterId: string; email: string; redirectUrl: string }) {
  const clerk = await clerkClient()
  const invitation = await clerk.organizations.createOrganizationInvitation({ organizationId: invite.orgId, inviterUserId: invite.inviterId, emailAddress: invite.email, role: OrgRole.admin, redirectUrl: invite.redirectUrl })

  const sent = { invitationId: invitation.id, email: invitation.emailAddress }
  return sent
}

export async function getOrganization(orgId: string) {
  const clerk = await clerkClient()
  const [organization, memberships, invitations] = await Promise.all([
    clerk.organizations.getOrganization({ organizationId: orgId }),
    clerk.organizations.getOrganizationMembershipList({ organizationId: orgId, }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: orgId, }),
  ])

  return {
    orgId,
    name: organization.name,
    slug: organization.slug ?? null,
    imageUrl: organization.imageUrl ?? null,
    membersCount: organization.membersCount ?? 0,
    clerkCreatedAt: new Date(organization.createdAt).toISOString(),
    members: memberships.data.map((m) => ({
      membershipId: m.id,
      userId: m.publicUserData?.userId ?? "",
      email: m.publicUserData?.identifier ?? "",
      firstName: m.publicUserData?.firstName ?? null,
      lastName: m.publicUserData?.lastName ?? null,
      imageUrl: m.publicUserData?.imageUrl ?? null,
      role: m.role,
      clerkCreatedAt: new Date(m.createdAt).toISOString(),
    })),
    invitations: invitations.data
      .filter((i) => i.status === "pending")
      .map((i) => ({
        invitationId: i.id,
        email: i.emailAddress,
        role: i.role,
        status: i.status ?? "pending",
        clerkCreatedAt: new Date(i.createdAt).toISOString(),
      })),
  }
}
