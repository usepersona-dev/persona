import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listInstructions, removeInstruction } from "@/usecases/instructions"

export const instructionDelete = (deferred = false) => defineTool({
  deferred,
  description: "Delete an instruction for good. To set one aside instead, turn it off with instruction_toggle.",
  inputSchema: z.object({ name: z.string().min(1) }),
  label: { start: ({ name }) => `Delete instruction ${name}` },
  async execute({ name }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listInstructions(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const instruction = listed.value.find((item) => item.name === name)
    if (!instruction) throw new Error(`There is no instruction named "${name}". Check instruction_list.`)

    const removed = await removeInstruction(caller, instruction.id)
    if (!removed.ok) throw new Error(removed.error.message)
    const result = { name, deleted: true }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.instruction
  if (!family.enabled) return null
  return instructionDelete(family.deferred)
})
