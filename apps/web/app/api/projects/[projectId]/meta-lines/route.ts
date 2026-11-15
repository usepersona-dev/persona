import { handler, readJson } from "@/app/api/handler"
import { connectMetaLine, listMetaLines } from "@/usecases/whatsapp-meta"

type Params = { projectId: string }

export const GET = handler<Params>(async (caller, { projectId }) => {
  const lines = await listMetaLines(caller, projectId)
  return lines
})

export const POST = handler<Params>(async (caller, { projectId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const line = await connectMetaLine(caller, projectId, input.value)
  return line
})
