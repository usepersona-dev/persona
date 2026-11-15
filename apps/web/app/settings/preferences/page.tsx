import type { Metadata } from "next"

import { requireSession } from "@/usecases/auth"

import { Preferences } from "./_components/preferences"

export const metadata: Metadata = { title: "Preferences · Persona" }

export default async function PreferencesPage() {
  await requireSession()
  return <Preferences />
}
