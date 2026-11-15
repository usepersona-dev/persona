import { redirect } from "next/navigation"

// Settings opens on its first section
export function GET() {
  redirect("/settings/preferences")
}
