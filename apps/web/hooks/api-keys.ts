import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as apiKeys from "@/usecases/api-keys"

export type ApiKey = ApiKeyList[number]
export type CreateApiKeyInput = Parameters<typeof apiKeys.createApiKey>[1]
type ApiKeyList = Output<typeof apiKeys.listApiKeys>
type CreatedApiKey = Output<typeof apiKeys.createApiKey>

export function useApiKeys() {
  const { data, error, isLoading } = useSWR<ApiKeyList, ApiError>("/api/api-keys", fetcher)
  return { apiKeys: data, error, isLoading }
}

export function useCreateApiKey() {
  const key = "/api/api-keys"
  const create = useAction(key, (input: CreateApiKeyInput) => request<CreatedApiKey>("POST", key, input))
  return create
}

export function useRevokeApiKey() {
  const key = "/api/api-keys"
  const revoke = useAction(key, (apiKeyId: string) => request<void>("DELETE", `/api/api-keys/${apiKeyId}`))
  return revoke
}
