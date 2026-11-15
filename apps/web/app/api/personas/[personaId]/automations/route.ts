import { handler, readJson } from "@/app/api/handler"
import { createAutomation, listAutomations } from "@/usecases/automations"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const automations = await listAutomations(caller, personaId)
  return automations
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const automation = await createAutomation(caller, personaId, input.value)
  return automation
})
