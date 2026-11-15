import "server-only"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { cache } from "react"

import { getOrganization, getUser, type OrgRole } from "@/lib/clerk"
import { db } from "@/prisma/db"

// An agent's caller acts as one persona and reaches that persona's rows only; a person signed in to the app reaches the whole organization
export type Caller = { orgId: string; userId: string; personaId?: string }

// Clerk counts a session that still waits for an organization as signed out, but keeps its status as pending
export const getSession = cache(async () => {
  const { userId, orgId, orgRole, sessionStatus } = await auth()
  if (sessionStatus === "pending") return { status: "pending" } as const
  if (!userId || !orgId) return { status: "signed-out" } as const

  let user = await db.orm.public.User.where({ authId: userId }).first()
  if (!user || !user.organizationIds.includes(orgId)) {
    await syncOrg(orgId)
    user = await syncUser(userId)
  }

  const organization = await db.orm.public.Organization.where({ orgId, }).first()
  if (!organization) return { status: "signed-out" } as const

  const caller: Caller = { orgId: organization.orgId, userId: user.authId }
  return { status: "active", user, organization, role: orgRole as OrgRole, caller } as const
})

export async function requireSession() {
  const session = await getSession()
  const { redirectToSignIn } = await auth()
  if (session.status === "pending") redirect("/orgs")
  if (session.status === "signed-out") return redirectToSignIn()

  return session
}

async function syncUser(authId: string) {
  const user = await getUser(authId)
  return await db.orm.public.User.upsert({ create: user, update: user, conflictOn: { authId }, })
}

async function syncOrg(orgId: string) {
  const organization = await getOrganization(orgId)
  const saved = await db.orm.public.Organization.upsert({ create: organization, update: organization, conflictOn: { orgId }, })
  return saved
}
