import { handler, readJson } from "@/app/api/handler"
import { removeAutomation, updateAutomation } from "@/usecases/automations"

type Params = { automationId: string }

export const PATCH = handler<Params>(async (caller, { automationId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const automation = await updateAutomation(caller, automationId, input.value)
  return automation
})

export const DELETE = handler<Params>(async (caller, { automationId }) => {
  const removed = await removeAutomation(caller, automationId)
  return removed
})
