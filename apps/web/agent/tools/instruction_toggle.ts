import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listInstructions, updateInstruction } from "@/usecases/instructions"

export const instructionToggle = (deferred = false) => defineTool({
  deferred,
  description: "Turn an instruction off without losing it, or back on. One that is off stops holding from the next turn on.",
  inputSchema: z.object({ name: z.string().min(1), enabled: z.boolean() }),
  label: { start: ({ name, enabled }) => `${enabled ? "Turn on" : "Turn off"} instruction ${name}` },
  async execute({ name, enabled }, ctx) {
    const { caller, personaId } = readCaller(ctx)
    const listed = await listInstructions(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const instruction = listed.value.find((item) => item.name === name)
    if (!instruction) throw new Error(`There is no instruction named "${name}". Check instruction_list.`)
    const updated = await updateInstruction(caller, instruction.id, { enabled })
    if (!updated.ok) throw new Error(updated.error.message)

    const result = { name: updated.value.name, enabled: updated.value.enabled }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.instruction
  if (!family.enabled) return null
  return instructionToggle(family.deferred)
})
