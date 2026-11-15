import { handler, readJson } from "@/app/api/handler"
import { completeFileUpload, listFiles } from "@/usecases/files"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const files = await listFiles(caller, personaId)
  return files
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const file = await completeFileUpload(caller, personaId, input.value)
  return file
})
