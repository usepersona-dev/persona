import { handler } from "@/app/api/handler"
import { createLinkCode, listLinkCodes } from "@/usecases/links"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const linkCodes = await listLinkCodes(caller, personaId)
  return linkCodes
})

export const POST = handler<Params>(async (caller, { personaId }) => {
  const linkCode = await createLinkCode(caller, personaId)
  return linkCode
})
