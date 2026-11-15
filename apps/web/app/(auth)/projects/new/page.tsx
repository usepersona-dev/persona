import type { Metadata } from "next"

import { requireSession } from "@/usecases/auth"
import { listProjects } from "@/usecases/projects"

import { NewProjectForm } from "./_components/new-project-form"

export const metadata: Metadata = { title: "New project · Persona" }

export default async function NewProjectPage() {
  const { caller } = await requireSession()
  const projects = await listProjects(caller)
  const first = projects.ok ? projects.value[0] : undefined

  return <NewProjectForm back={first?.name} />
}
