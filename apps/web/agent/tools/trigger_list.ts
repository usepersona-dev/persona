import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listTriggers } from "@/usecases/triggers"

export const triggerList = (deferred = false) => defineTool({
  deferred,
  description: "List your triggers, oldest first, with each one's id, task, trigger and the account it watches.",
  inputSchema: z.object({}),
  label: { start: () => "List triggers" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listTriggers(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const triggers = listed.value

    const result = { triggers: triggers.map((trigger) => ({ id: trigger.id, name: trigger.name, prompt: trigger.prompt, slug: trigger.slug, accountId: trigger.accountId })) }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.trigger
  if (!family.enabled) return null
  return triggerList(family.deferred)
})
