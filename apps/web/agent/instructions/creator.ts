import { defineDynamic, defineInstructions } from "eve/instructions"

import { readPersonaState } from "@/agent/lib/states/persona"

export default defineDynamic(() => {
  const { instructions } = readPersonaState()
  if (instructions.length === 0) return null

  const intro = "# Creator Rules\n\nWhat follows was written by your creator."
  const sections = instructions.map((instruction) => `## ${instruction.name}\n\n${instruction.content}`)
  const content = [intro, ...sections].join("\n\n")
  const result = defineInstructions({ content })
  return result
})
