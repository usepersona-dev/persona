import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as tools from "@/usecases/tools"

export type Tools = Output<typeof tools.listTools>
export type ToolName = keyof Tools
export type UpdateToolInput = Parameters<typeof tools.updateTool>[3]

export function useTools(personaId: string) {
  const { data, error, isLoading } = useSWR<Tools, ApiError>(`/api/personas/${personaId}/tools`, fetcher)
  return { tools: data, error, isLoading }
}

export function useUpdateTool(personaId: string, name: ToolName) {
  const key = `/api/personas/${personaId}/tools`
  const update = useAction(key, (input: UpdateToolInput) => request<Tools>("PATCH", `${key}/${name}`, input))
  return update
}
