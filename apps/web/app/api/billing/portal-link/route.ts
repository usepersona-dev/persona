import { handler } from "@/app/api/handler"
import { createPortalLink } from "@/usecases/billing"

export const POST = handler(async (caller) => {
  const link = await createPortalLink(caller)
  return link
})
