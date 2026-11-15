import { handler, readJson } from "@/app/api/handler"
import { createPersona, listPersonas } from "@/usecases/personas"

type Params = { projectId: string }

export const GET = handler<Params>(async (caller, { projectId }) => {
  const personas = await listPersonas(caller, projectId)
  return personas
})

export const POST = handler<Params>(async (caller, { projectId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const persona = await createPersona(caller, { ...input.value, projectId })
  return persona
})
