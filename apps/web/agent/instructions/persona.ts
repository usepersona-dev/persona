import { defineDynamic, defineInstructions } from "eve/instructions"

import { readCaller } from "@/usecases/agent"
import { getPersona } from "@/usecases/personas"

export default defineDynamic(async (ctx) => {
  const { caller, personaId } = readCaller(ctx)
  const turnId = ctx.turn?.id
  if (!turnId) return null

  // eve runs this before every model call; the name is read once per turn
  const name = await ctx.memo(turnId, async () => {
    const persona = await getPersona(caller, personaId)
    if (!persona.ok) throw new Error(persona.error.message)

    return persona.value.name
  })

  const content = `# Persona\n\nYou are ${name}.`
  const result = defineInstructions({ content })
  return result
})
