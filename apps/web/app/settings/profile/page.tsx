import type { Metadata } from "next"

import { requireSession } from "@/usecases/auth"

import { Profile } from "./_components/profile"

export const metadata: Metadata = { title: "Profile · Persona" }

export default async function ProfilePage() {
  await requireSession()
  return <Profile />
}
