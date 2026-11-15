import type { Metadata } from "next"

import { requireSession } from "@/usecases/auth"

import { Usage } from "./_components/usage"

export const metadata: Metadata = { title: "Usage · Persona" }

export default async function UsagePage() {
  await requireSession()
  return <Usage />
}
