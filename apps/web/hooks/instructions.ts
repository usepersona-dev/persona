import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as instructions from "@/usecases/instructions"

export type Instruction = InstructionList[number]
export type AddInstructionInput = Parameters<typeof instructions.addInstruction>[2]
export type UpdateInstructionInput = Parameters<typeof instructions.updateInstruction>[2]
type InstructionList = Output<typeof instructions.listInstructions>
type InstructionRef = { id: string; personaId: string }

export function useInstructions(personaId: string) {
  const { data, error, isLoading } = useSWR<InstructionList, ApiError>(`/api/personas/${personaId}/instructions`, fetcher)
  return { instructions: data, error, isLoading }
}

export function useAddInstruction(personaId: string) {
  const key = `/api/personas/${personaId}/instructions`
  const add = useAction(key, (input: AddInstructionInput) => request<Instruction>("POST", key, input))
  return add
}

export function useUpdateInstruction(instruction: InstructionRef) {
  const key = `/api/personas/${instruction.personaId}/instructions`
  const update = useAction(key, (input: UpdateInstructionInput) => request<Instruction>("PATCH", `/api/instructions/${instruction.id}`, input))
  return update
}

export function useRemoveInstruction(personaId: string) {
  const key = `/api/personas/${personaId}/instructions`
  const remove = useAction(key, (instructionId: string) => request<void>("DELETE", `/api/instructions/${instructionId}`))
  return remove
}
