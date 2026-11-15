import { handler, readJson } from "@/app/api/handler"
import { getProject, removeProject, updateProject } from "@/usecases/projects"

type Params = { projectId: string }

export const GET = handler<Params>(async (caller, { projectId }) => {
  const project = await getProject(caller, projectId)
  return project
})

export const PATCH = handler<Params>(async (caller, { projectId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const project = await updateProject(caller, projectId, input.value)
  return project
})

export const DELETE = handler<Params>(async (caller, { projectId }) => {
  const removed = await removeProject(caller, projectId)
  return removed
})
