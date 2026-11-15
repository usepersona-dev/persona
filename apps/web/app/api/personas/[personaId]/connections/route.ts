import { handler, readJson } from "@/app/api/handler"
import { addConnection, listConnections } from "@/usecases/connections"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const connections = await listConnections(caller, personaId)
  return connections
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const connection = await addConnection(caller, personaId, input.value)
  return connection
})
