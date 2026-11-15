import useSWR, { mutate } from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as projects from "@/usecases/projects"

export type Project = Output<typeof projects.getProject>
export type CreateProjectInput = Parameters<typeof projects.createProject>[1]
export type UpdateProjectInput = Parameters<typeof projects.updateProject>[2]
type ProjectList = Output<typeof projects.listProjects>
type CreatedProject = Output<typeof projects.createProject>

export function useProjects() {
  const { data, error, isLoading } = useSWR<ProjectList, ApiError>("/api/projects", fetcher)
  return { projects: data, error, isLoading }
}

export function useProject(projectId: string) {
  const { data, error, isLoading } = useSWR<Project, ApiError>(`/api/projects/${projectId}`, fetcher)
  return { project: data, error, isLoading }
}

export function useCreateProject() {
  const key = "/api/projects"
  const create = useAction(key, (input: CreateProjectInput) => request<CreatedProject>("POST", key, input))
  return create
}

export function useUpdateProject(projectId: string) {
  const key = `/api/projects/${projectId}`
  const update = useAction(key, (input: UpdateProjectInput) => request<Project>("PATCH", key, input), { onSuccess: () => mutate("/api/projects") })
  return update
}

export function useRemoveProject() {
  const key = "/api/projects"
  const remove = useAction(key, (projectId: string) => request<void>("DELETE", `/api/projects/${projectId}`))
  return remove
}
