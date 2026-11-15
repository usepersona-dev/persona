import type { Metadata } from "next"

import { requireSession } from "@/usecases/auth"

import { ApiKeys } from "./_components/api-keys"

export const metadata: Metadata = { title: "API keys · Persona" }

export default async function ApiKeysPage() {
  await requireSession()
  return <ApiKeys />
}
