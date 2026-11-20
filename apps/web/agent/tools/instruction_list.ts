import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listInstructions } from "@/usecases/instructions"

export const instructionList = (deferred = false) => defineTool({
  deferred,
  description: "List your instructions, each with its name, its text and whether it is on. Read it before changing or removing one.",
  inputSchema: z.object({}),
  label: { start: () => "List instructions" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listInstructions(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const instructions = listed.value

    const result = { instructions: instructions.map((instruction) => ({ name: instruction.name, content: instruction.content, enabled: instruction.enabled })) }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.instruction
  if (!family.enabled) return null
  return instructionList(family.deferred)
})
