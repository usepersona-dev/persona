import { handler } from "@/app/api/handler"
import { createCollectLink } from "@/usecases/vault"

type Params = { credentialId: string }

export const POST = handler<Params>(async (caller, { credentialId }) => {
  const link = await createCollectLink(caller, credentialId)
  return link
})
