import { handler, readJson } from "@/app/api/handler"
import { unlink, updateLink } from "@/usecases/links"

type Params = { channel: string; line: string; externalId: string }

export const PATCH = handler<Params>(async (caller, { channel, line, externalId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input

  const ref = { channel, line, externalId } as Parameters<typeof updateLink>[1]
  const link = await updateLink(caller, ref, input.value)
  return link
})

export const DELETE = handler<Params>(async (caller, { channel, line, externalId }) => {
  const address = { channel, line, externalId } as Parameters<typeof unlink>[1]
  const unlinked = await unlink(caller, address)
  return unlinked
})
