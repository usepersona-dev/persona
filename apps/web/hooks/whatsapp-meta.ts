import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as whatsapp from "@/usecases/whatsapp-meta"

export type MetaLine = MetaLines["lines"][number]
export type SharedMetaNumber = MetaLines["shared"]
export type MetaLineInput = Parameters<typeof whatsapp.connectMetaLine>[2]
type MetaLines = Output<typeof whatsapp.listMetaLines>

export function useMetaLines(projectId: string) {
  const { data, error, isLoading } = useSWR<MetaLines, ApiError>(`/api/projects/${projectId}/meta-lines`, fetcher)
  const shared = data?.shared
  const lines = data?.lines
  return { shared, lines, error, isLoading }
}

export function useConnectMetaLine(projectId: string) {
  const key = `/api/projects/${projectId}/meta-lines`
  const connect = useAction(key, (input: MetaLineInput) => request<MetaLine>("POST", key, input))
  return connect
}

export function useRemoveMetaLine(projectId: string) {
  const key = `/api/projects/${projectId}/meta-lines`
  const remove = useAction(key, (lineId: string) => request<void>("DELETE", `/api/meta-lines/${lineId}`))
  return remove
}
