import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ChooseOrganization } from "./_components/choose-organization"

export const metadata: Metadata = { title: "Choose an organization · Persona" }

// Any session comes here: a pending one picks its first organization, an active one switches organizations.
// Clerk's sessionStatus is "active" or "pending" with a session, and null only without one.
export default async function OrgsPage() {
  const { sessionStatus } = await auth()
  if (!sessionStatus) redirect("/sign-in")

  return <ChooseOrganization />
}
