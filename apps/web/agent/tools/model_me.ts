import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { DEFAULT_MODEL, getPersona } from "@/usecases/personas"

export const modelMe = (deferred = false) => defineTool({
  deferred,
  description: "The models you run on now, each with when to use it. With none set, you run on the default model. With two or more, each message runs on the one whose when fits it.",
  inputSchema: z.object({}),
  label: { start: () => "Check my models" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const persona = await getPersona(caller, personaId)
    if (!persona.ok) throw new Error(persona.error.message)

    const result = { models: persona.value.models, default: DEFAULT_MODEL }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.model
  if (!family.enabled) return null
  return modelMe(family.deferred)
})
