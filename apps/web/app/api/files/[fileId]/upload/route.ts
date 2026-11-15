import { handler, readJson } from "@/app/api/handler"
import { getFileReplaceUpload } from "@/usecases/files"

type Params = { fileId: string }

export const POST = handler<Params>(async (caller, { fileId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const upload = await getFileReplaceUpload(caller, fileId, input.value)
  return upload
})
