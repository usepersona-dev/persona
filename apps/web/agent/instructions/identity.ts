import { defineDynamic, defineInstructions } from "eve/instructions"

import { readPersonaState } from "@/agent/lib/states/persona"

export default defineDynamic(() => {
  const { name } = readPersonaState()
  const content = `# Persona\n\nYou are ${name}.`
  const result = defineInstructions({ content })
  return result
})
