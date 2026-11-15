import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { addInstruction, listInstructions, updateInstruction } from "@/usecases/instructions"

export default defineTool({
  description: "Save an instruction you'll follow in every conversation from the next turn on, such as which language to answer in or how to sound. Saving under an existing name replaces that instruction's text, so revise a rule under its name rather than adding a second one.",
  inputSchema: z.object({
    name: z.string().trim().min(1).max(80).describe("A short, stable name, such as Language or Tone."),
    content: z.string().trim().min(1).max(50_000).describe("The instruction itself, written to you."),
  }),
  label: { start: ({ name }) => `Save instruction ${name}` },
  async execute({ name, content }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listInstructions(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const existing = listed.value.find((instruction) => instruction.name === name)
    const saved = existing ? await updateInstruction(caller, existing.id, { content }) : await addInstruction(caller, personaId, { name, content })
    if (!saved.ok) throw new Error(saved.error.message)

    const result = { name: saved.value.name, enabled: saved.value.enabled }
    return result
  },
})
