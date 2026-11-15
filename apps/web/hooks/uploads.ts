import { useAction } from "@/hooks/use-action"
import { request, uploadTo } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as uploads from "@/usecases/uploads"

type Upload = Output<typeof uploads.createUpload>

// Uploads a picture straight to the storage and answers its public URL, ready for a record's imageUrl
export function useUpload() {
  const key = "/api/uploads"
  const upload = useAction(key, (file: File) => uploadFile(file))
  return upload
}

async function uploadFile(file: File) {
  const target = await request<Upload>("POST", "/api/uploads", { contentType: file.type })
  await uploadTo(target.uploadUrl, file, file.type)
  return target.url
}
