import { defineDynamic, defineMcpClientConnection } from "eve/connections"

import { readCaller } from "@/usecases/agent"
import { listConnections } from "@/usecases/connections"
import { readSecret } from "@/usecases/secrets"

export default defineDynamic(async (ctx) => {
  const { caller, personaId } = readCaller(ctx)
  const turnId = ctx.turn?.id
  if (!turnId) return null

  // eve runs this before every model call; the connections are read once per turn
  const enabled = await ctx.memo(turnId, async () => {
    const connections = await listConnections(caller, personaId)
    if (!connections.ok) throw new Error(connections.error.message)
    return connections.value.filter((connection) => connection.enabled).map((connection) => ({ id: connection.id, name: connection.name, url: connection.url, description: connection.description }))
  })
  if (enabled.length === 0) return null

  const entries = enabled.map((connection) => [connection.name, defineMcpClientConnection({ url: connection.url, description: connection.description || `Tools from ${connection.name}.`, instanceKey: connection.id, headers: () => readHeaders(connection.id) })])
  const result = Object.fromEntries(entries)
  return result
})

async function readHeaders(connectionId: string) {
  const values = await readSecret(connectionId)
  const entries = values.map((value) => [value.name, value.value])
  const headers = Object.fromEntries(entries)
  return headers
}
