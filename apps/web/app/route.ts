import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { requireSession } from "@/usecases/auth"
import { listProjects } from "@/usecases/projects"

// The project seen last (the project page keeps its id in the "project" cookie), else the first one
export async function GET() {
  const { caller } = await requireSession()
  const projects = await listProjects(caller)
  const cookieStore = await cookies()
  const lastId = cookieStore.get("project")?.value
  const list = projects.ok ? projects.value : []
  const last = list.find((project) => project.id === lastId)
  const project = last ?? list[0]

  if (!project) redirect("/projects/new")
  redirect(`/project/${project.id}`)
}
