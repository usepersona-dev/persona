import { handler, readJson } from "@/app/api/handler"
import { addCredential, listCredentials } from "@/usecases/vault"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const credentials = await listCredentials(caller, personaId)
  return credentials
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const credential = await addCredential(caller, personaId, input.value)
  return credential
})
