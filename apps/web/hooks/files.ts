import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, uploadTo, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as files from "@/usecases/files"

export type FileDetail = Output<typeof files.getFileView>
type FileUpload = Output<typeof files.getFileUpload>
type SavedFile = Output<typeof files.completeFileUpload>

const UNKNOWN_TYPE = "application/octet-stream"

export function useFile(fileId: string) {
  const { data, error, isLoading } = useSWR<FileDetail, ApiError>(`/api/files/${fileId}`, fetcher)
  return { file: data, error, isLoading }
}

export function useUploadFile(personaId: string) {
  const key = `/api/personas/${personaId}/files`
  const upload = useAction(key, (file: File) => uploadFile(personaId, file))
  return upload
}

export function useRemoveFile(personaId: string) {
  const key = `/api/personas/${personaId}/files`
  const remove = useAction(key, (fileId: string) => request<void>("DELETE", `/api/files/${fileId}`))
  return remove
}

async function uploadFile(personaId: string, file: File) {
  const contentType = file.type || UNKNOWN_TYPE
  const target = await request<FileUpload>("POST", `/api/personas/${personaId}/files/upload`, { name: file.name, contentType })
  await uploadTo(target.uploadUrl, file, contentType)

  const saved = await request<SavedFile>("POST", `/api/personas/${personaId}/files`, { fileId: target.fileId, name: file.name })
  const stored = await request<FileDetail>("GET", `/api/files/${saved.id}`)
  return stored
}
