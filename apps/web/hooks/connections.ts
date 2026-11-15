import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as connections from "@/usecases/connections"

export type Connection = ConnectionList[number]
export type ConnectionCheck = Output<typeof connections.checkConnection>
export type AddConnectionInput = Parameters<typeof connections.addConnection>[2]
export type UpdateConnectionInput = Parameters<typeof connections.updateConnection>[2]
export type CheckConnectionInput = Parameters<typeof connections.checkConnection>[1]
type ConnectionList = Output<typeof connections.listConnections>
type AddedConnection = Output<typeof connections.addConnection>
type UpdatedConnection = Output<typeof connections.updateConnection>
type ConnectionRef = { id: string; personaId: string }

export function useConnections(personaId: string) {
  const { data, error, isLoading } = useSWR<ConnectionList, ApiError>(`/api/personas/${personaId}/connections`, fetcher)
  return { connections: data, error, isLoading }
}

export function useAddConnection(personaId: string) {
  const key = `/api/personas/${personaId}/connections`
  const add = useAction(key, (input: AddConnectionInput) => request<AddedConnection>("POST", key, input))
  return add
}

export function useUpdateConnection(connection: ConnectionRef) {
  const key = `/api/personas/${connection.personaId}/connections`
  const update = useAction(key, (input: UpdateConnectionInput) => request<UpdatedConnection>("PATCH", `/api/connections/${connection.id}`, input))
  return update
}

export function useRemoveConnection(personaId: string) {
  const key = `/api/personas/${personaId}/connections`
  const remove = useAction(key, (connectionId: string) => request<void>("DELETE", `/api/connections/${connectionId}`))
  return remove
}

export function useCheckConnection() {
  const key = "/api/connections/check"
  const check = useAction(key, (input: CheckConnectionInput) => request<ConnectionCheck>("POST", key, input))
  return check
}
