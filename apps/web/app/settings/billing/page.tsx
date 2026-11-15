import type { Metadata } from "next"

import { requireSession } from "@/usecases/auth"

import { Billing } from "./_components/billing"

export const metadata: Metadata = { title: "Billing · Persona" }

export default async function BillingPage() {
  await requireSession()
  return <Billing />
}
