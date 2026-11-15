import { handler, readJson } from "@/app/api/handler"
import { removeCredential, updateCredential } from "@/usecases/vault"

type Params = { credentialId: string }

export const PATCH = handler<Params>(async (caller, { credentialId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const credential = await updateCredential(caller, credentialId, input.value)
  return credential
})

export const DELETE = handler<Params>(async (caller, { credentialId }) => {
  const removed = await removeCredential(caller, credentialId)
  return removed
})
