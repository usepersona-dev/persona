import type { Metadata } from "next"

import { Collect } from "../_components/collect"

export const metadata: Metadata = { title: "Fill in the vault · Persona" }

// No sign-in here: whoever has the link may fill it in, until it expires
export default async function CollectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <Collect token={token} />
}
