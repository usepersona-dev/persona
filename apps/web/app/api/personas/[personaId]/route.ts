import { handler, readJson } from "@/app/api/handler"
import { getPersona, removePersona, updatePersona } from "@/usecases/personas"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const persona = await getPersona(caller, personaId)
  return persona
})

export const PATCH = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const persona = await updatePersona(caller, personaId, input.value)
  return persona
})

export const DELETE = handler<Params>(async (caller, { personaId }) => {
  const removed = await removePersona(caller, personaId)
  return removed
})
