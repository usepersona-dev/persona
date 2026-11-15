import { handler, readJson } from "@/app/api/handler"
import { createUpload } from "@/usecases/uploads"

export const POST = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const upload = await createUpload(caller, input.value)
  return upload
})
