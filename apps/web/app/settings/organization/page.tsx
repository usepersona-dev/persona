import type { Metadata } from "next"

import { requireSession } from "@/usecases/auth"

import { Organization } from "./_components/organization"

export const metadata: Metadata = { title: "Organization · Persona" }

export default async function OrganizationPage() {
  await requireSession()
  return <Organization />
}
