import { handler } from "@/app/api/handler"
import { removeMetaLine } from "@/usecases/whatsapp-meta"

type Params = { lineId: string }

export const DELETE = handler<Params>(async (caller, { lineId }) => {
  const removed = await removeMetaLine(caller, lineId)
  return removed
})
