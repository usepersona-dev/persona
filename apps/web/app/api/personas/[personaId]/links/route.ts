import { handler } from "@/app/api/handler"
import { listLinks } from "@/usecases/links"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const links = await listLinks(caller, personaId)
  return links
})
