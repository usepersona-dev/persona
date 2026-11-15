import { handler, readJson } from "@/app/api/handler"
import { setCredentialValues } from "@/usecases/vault"

type Params = { credentialId: string }

export const PUT = handler<Params>(async (caller, { credentialId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const values = await setCredentialValues(caller, credentialId, input.value)
  return values
})
