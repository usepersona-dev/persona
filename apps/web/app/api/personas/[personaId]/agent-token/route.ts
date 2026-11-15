import { handler } from "@/app/api/handler"
import { createAgentToken } from "@/usecases/agent"

type Params = { personaId: string }

export const POST = handler<Params>(async (caller, { personaId }) => {
  const agentToken = await createAgentToken(caller, personaId)
  return agentToken
})
