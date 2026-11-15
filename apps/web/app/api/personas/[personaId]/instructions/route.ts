import { handler, readJson } from "@/app/api/handler"
import { addInstruction, listInstructions } from "@/usecases/instructions"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const instructions = await listInstructions(caller, personaId)
  return instructions
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const instruction = await addInstruction(caller, personaId, input.value)
  return instruction
})
