import { handler } from "@/app/api/handler"
import { unlink } from "@/usecases/links"

type Params = { channel: string; line: string; externalId: string }

export const DELETE = handler<Params>(async (caller, { channel, line, externalId }) => {
  const address = { channel, line, externalId } as Parameters<typeof unlink>[1]
  const unlinked = await unlink(caller, address)
  return unlinked
})
