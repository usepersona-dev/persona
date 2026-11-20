import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listAutomations } from "@/usecases/automations"

export const automationList = (deferred = false) => defineTool({
  deferred,
  description: "List what you are scheduled to do, oldest first, with each automation's id, task, timing and whether it is on. Read it before changing one the person described loosely; automation_runs tells how one has been going.",
  inputSchema: z.object({}),
  label: { start: () => "List automations" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listAutomations(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const automations = listed.value

    const result = { automations: automations.map((automation) => ({ id: automation.id, name: automation.name, prompt: automation.prompt, at: automation.at, cron: automation.cron, timezone: automation.timezone, enabled: automation.enabled })) }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.automation
  if (!family.enabled) return null
  return automationList(family.deferred)
})
