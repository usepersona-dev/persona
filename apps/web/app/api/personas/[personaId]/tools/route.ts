import { handler } from "@/app/api/handler"
import { listTools } from "@/usecases/tools"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const tools = await listTools(caller, personaId)
  return tools
})
