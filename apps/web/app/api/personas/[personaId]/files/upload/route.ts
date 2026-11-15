import { handler, readJson } from "@/app/api/handler"
import { getFileUpload } from "@/usecases/files"

type Params = { personaId: string }

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const upload = await getFileUpload(caller, personaId, input.value)
  return upload
})
