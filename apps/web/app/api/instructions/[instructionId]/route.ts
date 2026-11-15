import { handler, readJson } from "@/app/api/handler"
import { removeInstruction, updateInstruction } from "@/usecases/instructions"

type Params = { instructionId: string }

export const PATCH = handler<Params>(async (caller, { instructionId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const instruction = await updateInstruction(caller, instructionId, input.value)
  return instruction
})

export const DELETE = handler<Params>(async (caller, { instructionId }) => {
  const removed = await removeInstruction(caller, instructionId)
  return removed
})
