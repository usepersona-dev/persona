import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listAppTriggers } from "@/usecases/triggers"

export const triggerTypes = (deferred = false) => defineTool({
  deferred,
  description: "List the triggers a connected app offers, such as a new email in gmail or a meeting about to start in googlecalendar, with each one's settings.",
  inputSchema: z.object({ app: z.string().trim().min(1).describe("The app's slug, such as gmail or googlecalendar.") }),
  label: { start: ({ app }) => `Look up ${app} triggers` },
  async execute({ app }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listAppTriggers(caller, personaId, app)
    if (!listed.ok) throw new Error(listed.error.message)
    const types = listed.value

    const result = { triggers: types.map((type) => ({ slug: type.slug, name: type.name, description: type.description, settings: type.config })) }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.trigger
  if (!family.enabled) return null
  return triggerTypes(family.deferred)
})
