import { handler, readJson } from "@/app/api/handler"
import { removeConnection, updateConnection } from "@/usecases/connections"

type Params = { connectionId: string }

export const PATCH = handler<Params>(async (caller, { connectionId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const connection = await updateConnection(caller, connectionId, input.value)
  return connection
})

export const DELETE = handler<Params>(async (caller, { connectionId }) => {
  const removed = await removeConnection(caller, connectionId)
  return removed
})
