import useSWR from "swr"
import useSWRImmutable from "swr/immutable"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as integrations from "@/usecases/integrations"

export type App = AppList[number]
export type ConnectedApp = ConnectedAppList[number]
export type ConnectAppInput = Parameters<typeof integrations.connectApp>[2]
type AppList = Output<typeof integrations.listApps>
type ConnectedAppList = Output<typeof integrations.listConnectedApps>
type AppConnection = Output<typeof integrations.connectApp>

export function useApps() {
  const { data, error, isLoading } = useSWRImmutable<AppList, ApiError>("/api/apps", fetcher)
  return { apps: data, error, isLoading }
}

export function useConnectedApps(personaId: string) {
  const { data, error, isLoading } = useSWR<ConnectedAppList, ApiError>(`/api/personas/${personaId}/apps`, fetcher)
  return { apps: data, error, isLoading }
}

export function useConnectApp(personaId: string) {
  const key = `/api/personas/${personaId}/apps`
  const connect = useAction(key, (input: ConnectAppInput) => request<AppConnection>("POST", key, input))
  return connect
}

export function useDisconnectApp(personaId: string) {
  const key = `/api/personas/${personaId}/apps`
  const disconnect = useAction(key, (accountId: string) => request<void>("DELETE", `${key}/${encodeURIComponent(accountId)}`))
  return disconnect
}
