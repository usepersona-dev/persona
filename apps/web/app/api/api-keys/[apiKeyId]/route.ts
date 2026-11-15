import { handler } from "@/app/api/handler"
import { revokeApiKey } from "@/usecases/api-keys"

type Params = { apiKeyId: string }

export const DELETE = handler<Params>(async (caller, { apiKeyId }) => {
  const revoked = await revokeApiKey(caller, apiKeyId)
  return revoked
})
