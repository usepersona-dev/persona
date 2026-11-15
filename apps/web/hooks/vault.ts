import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as vault from "@/usecases/vault"

export type VaultCredential = CredentialList[number]
export type CollectLink = Output<typeof vault.createCollectLink>
export type CollectForm = Output<typeof vault.openCollectLink>
export type AddCredentialInput = Parameters<typeof vault.addCredential>[2]
export type UpdateCredentialInput = Parameters<typeof vault.updateCredential>[2]
export type CredentialValues = Parameters<typeof vault.setCredentialValues>[2]
export type CollectedValues = Parameters<typeof vault.submitCollectLink>[1]
type CredentialList = Output<typeof vault.listCredentials>
type FilledFields = Output<typeof vault.setCredentialValues>
type CredentialRef = { id: string; personaId: string }

export function useCredentials(personaId: string) {
  const { data, error, isLoading } = useSWR<CredentialList, ApiError>(`/api/personas/${personaId}/credentials`, fetcher)
  return { credentials: data, error, isLoading }
}

export function useCollectForm(token: string) {
  const { data, error, isLoading } = useSWR<CollectForm, ApiError>(`/api/collect/${encodeURIComponent(token)}`, fetcher)
  return { form: data, error, isLoading }
}

export function useAddCredential(personaId: string) {
  const key = `/api/personas/${personaId}/credentials`
  const add = useAction(key, (input: AddCredentialInput) => request<VaultCredential>("POST", key, input))
  return add
}

export function useUpdateCredential(credential: CredentialRef) {
  const key = `/api/personas/${credential.personaId}/credentials`
  const update = useAction(key, (input: UpdateCredentialInput) => request<VaultCredential>("PATCH", `/api/credentials/${credential.id}`, input))
  return update
}

export function useRemoveCredential(personaId: string) {
  const key = `/api/personas/${personaId}/credentials`
  const remove = useAction(key, (credentialId: string) => request<void>("DELETE", `/api/credentials/${credentialId}`))
  return remove
}

export function useSetCredentialValues(personaId: string) {
  const key = `/api/personas/${personaId}/credentials`
  const setValues = useAction(key, ({ id, values }: { id: string; values: CredentialValues }) => request<FilledFields>("PUT", `/api/credentials/${id}/values`, values))
  return setValues
}

export function useCreateCollectLink(credentialId: string) {
  const key = `/api/credentials/${credentialId}/collect-link`
  const create = useAction(key, () => request<CollectLink>("POST", key))
  return create
}

export function useSubmitCollectForm(token: string) {
  const key = `/api/collect/${encodeURIComponent(token)}`
  const submit = useAction(key, (values: CollectedValues) => request<FilledFields>("POST", key, values))
  return submit
}
