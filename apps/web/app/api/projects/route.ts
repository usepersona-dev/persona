import { handler, readJson } from "@/app/api/handler"
import { createProject, listProjects } from "@/usecases/projects"

export const GET = handler(async (caller) => {
  const projects = await listProjects(caller)
  return projects
})

export const POST = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const created = await createProject(caller, input.value)
  return created
})
