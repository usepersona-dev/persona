import { defineDynamic, defineInstructions } from "eve/instructions"

import { readCaller } from "@/usecases/agent"
import { listInstructions } from "@/usecases/instructions"

type Instruction = { name: string; content: string }

export default defineDynamic(async (ctx) => {
  const { caller, personaId } = readCaller(ctx)
  const turnId = ctx.turn?.id
  if (!turnId) return null

  // eve runs this before every model call; the instructions are read once per turn
  const content = await ctx.memo(turnId, async () => {
    const instructions = await listInstructions(caller, personaId)
    if (!instructions.ok) throw new Error(instructions.error.message)

    const enabled = instructions.value.filter((instruction) => instruction.enabled)
    if (enabled.length === 0) return null

    return writePrompt(enabled)
  })
  if (!content) return null

  const result = defineInstructions({ content })
  return result
})

function writePrompt(instructions: Instruction[]) {
  const intro = "# Creator Rules\n\nWhat follows was written by your creator."
  const sections = instructions.map((instruction) => `## ${instruction.name}\n\n${instruction.content}`)
  const prompt = [intro, ...sections].join("\n\n")
  return prompt
}
