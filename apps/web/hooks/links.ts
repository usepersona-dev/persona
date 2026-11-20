import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as links from "@/usecases/links"

export type LinkCode = LinkCodeList[number]
export type Link = LinkList[number]
export type UpdateLinkInput = Parameters<typeof links.updateLink>[2]
type LinkCodeList = Output<typeof links.listLinkCodes>
type LinkList = Output<typeof links.listLinks>
type LinkRef = { channel: string; line: string; externalId: string }

export function useLinkCodes(personaId: string) {
  const { data, error, isLoading } = useSWR<LinkCodeList, ApiError>(`/api/personas/${personaId}/link-codes`, fetcher)
  return { linkCodes: data, error, isLoading }
}

export function useLinks(personaId: string) {
  const { data, error, isLoading } = useSWR<LinkList, ApiError>(`/api/personas/${personaId}/links`, fetcher)
  return { links: data, error, isLoading }
}

export function useCreateLinkCode(personaId: string) {
  const key = `/api/personas/${personaId}/link-codes`
  const create = useAction(key, () => request<LinkCode>("POST", key))
  return create
}

export function useRemoveLinkCode(personaId: string) {
  const key = `/api/personas/${personaId}/link-codes`
  const remove = useAction(key, (code: string) => request<void>("DELETE", `/api/link-codes/${encodeURIComponent(code)}`))
  return remove
}

export function useUpdateLink(personaId: string, link: LinkRef) {
  const key = `/api/personas/${personaId}/links`
  const update = useAction(key, (input: UpdateLinkInput) => request<Link>("PATCH", `/api/links/${link.channel}/${encodeURIComponent(link.line)}/${encodeURIComponent(link.externalId)}`, input))
  return update
}

export function useUnlink(personaId: string) {
  const key = `/api/personas/${personaId}/links`
  const unlink = useAction(key, (link: LinkRef) => request<void>("DELETE", `/api/links/${link.channel}/${encodeURIComponent(link.line)}/${encodeURIComponent(link.externalId)}`))
  return unlink
}
