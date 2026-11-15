import { handler } from "@/app/api/handler"
import { removeLinkCode } from "@/usecases/links"

type Params = { code: string }

export const DELETE = handler<Params>(async (caller, { code }) => {
  const removed = await removeLinkCode(caller, code)
  return removed
})
