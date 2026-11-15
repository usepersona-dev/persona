import { SignIn } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthClerkCard, clerkCard } from "../../_components/auth-layout"

export const metadata: Metadata = { title: "Sign in · Persona" }

export default async function SignInPage() {
  const { isAuthenticated, sessionStatus } = await auth()
  if (isAuthenticated) redirect("/")
  if (sessionStatus === "pending") redirect("/orgs")

  return (
    <AuthClerkCard>
      <SignIn appearance={{ elements: clerkCard }} />
    </AuthClerkCard>
  )
}
