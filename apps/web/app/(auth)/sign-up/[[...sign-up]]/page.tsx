import { SignUp } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthClerkCard, clerkCard } from "../../_components/auth-layout"

export const metadata: Metadata = { title: "Sign up · Persona" }

export default async function SignUpPage() {
  const { isAuthenticated, sessionStatus } = await auth()
  if (isAuthenticated) redirect("/")
  if (sessionStatus === "pending") redirect("/orgs")

  return (
    <AuthClerkCard>
      <SignUp appearance={{ elements: clerkCard }} />
    </AuthClerkCard>
  )
}
