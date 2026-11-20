import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { updateAutomation } from "@/usecases/automations"

export const automationUpdate = (deferred = false) => defineTool({
  deferred,
  description: "Change an automation: its name, its task, its timing, or whether it runs at all. Give at to make it a one-time run at that date, or cron to make it repeat, and set the other one to null. To stop one without losing it, set enabled to false.",
  inputSchema: z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(80).optional(),
    prompt: z.string().trim().min(1).max(20_000).optional(),
    at: z.iso.datetime({ offset: true }).nullable().optional(),
    cron: z.string().nullable().optional(),
    timezone: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
  label: { start: () => "Update automation" },
  async execute({ id, ...changes }, ctx) {
    const { caller } = readCaller(ctx)

    const updated = await updateAutomation(caller, id, changes)
    if (!updated.ok) throw new Error(updated.error.message)
    const automation = updated.value

    const result = { id: automation.id, name: automation.name, at: automation.at, cron: automation.cron, timezone: automation.timezone, enabled: automation.enabled }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.automation
  if (!family.enabled) return null
  return automationUpdate(family.deferred)
})
