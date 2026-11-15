import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as webhooks from "@/usecases/webhooks"

export type Webhook = WebhookList[number]
export type CreateWebhookInput = Parameters<typeof webhooks.createWebhook>[2]
export type UpdateWebhookInput = Parameters<typeof webhooks.updateWebhook>[2]
type WebhookList = Output<typeof webhooks.listWebhooks>
type WebhookRef = { id: string; personaId: string }

export function useWebhooks(personaId: string) {
  const { data, error, isLoading } = useSWR<WebhookList, ApiError>(`/api/personas/${personaId}/webhooks`, fetcher)
  return { webhooks: data, error, isLoading }
}

export function useCreateWebhook(personaId: string) {
  const key = `/api/personas/${personaId}/webhooks`
  const create = useAction(key, (input: CreateWebhookInput) => request<Webhook>("POST", key, input))
  return create
}

export function useUpdateWebhook(webhook: WebhookRef) {
  const key = `/api/personas/${webhook.personaId}/webhooks`
  const update = useAction(key, (input: UpdateWebhookInput) => request<Webhook>("PATCH", `/api/webhooks/${webhook.id}`, input))
  return update
}

export function useRemoveWebhook(personaId: string) {
  const key = `/api/personas/${personaId}/webhooks`
  const remove = useAction(key, (webhookId: string) => request<void>("DELETE", `/api/webhooks/${webhookId}`))
  return remove
}
