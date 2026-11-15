import { handler, readJson } from "@/app/api/handler"
import { connectApp, listConnectedApps } from "@/usecases/integrations"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const apps = await listConnectedApps(caller, personaId)
  return apps
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const connect = await connectApp(caller, personaId, input.value)
  return connect
})
