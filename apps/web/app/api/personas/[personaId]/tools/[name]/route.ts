import { handler, readJson } from "@/app/api/handler"
import { updateTool } from "@/usecases/tools"

type Params = { personaId: string; name: string }

export const PATCH = handler<Params>(async (caller, { personaId, name }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  
  const tools = await updateTool(caller, personaId, name, input.value)
  return tools
})
