import { handler } from "@/app/api/handler"
import { disconnectApp } from "@/usecases/integrations"

type Params = { personaId: string; accountId: string }

export const DELETE = handler<Params>(async (caller, { personaId, accountId }) => {
  const disconnected = await disconnectApp(caller, personaId, accountId)
  return disconnected
})
