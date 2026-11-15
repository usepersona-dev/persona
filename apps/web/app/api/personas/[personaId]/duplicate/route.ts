import { handler, readJson } from "@/app/api/handler"
import { duplicatePersona } from "@/usecases/personas"

type Params = { personaId: string }

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const copy = await duplicatePersona(caller, personaId, input.value)
  return copy
})
