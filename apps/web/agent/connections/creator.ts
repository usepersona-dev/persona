import { defineDynamic, defineMcpClientConnection } from "eve/connections"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readSecret } from "@/usecases/secrets"

export default defineDynamic(() => {
  const { connections } = readPersonaState()
  if (connections.length === 0) return null

  const entries = connections.map((connection) => [connection.name, defineMcpClientConnection({ url: connection.url, description: connection.description || `Tools from ${connection.name}.`, instanceKey: connection.id, headers: () => readHeaders(connection.id) })])
  const result = Object.fromEntries(entries)
  return result
})

async function readHeaders(connectionId: string) {
  const values = await readSecret(connectionId)
  const entries = values.map((value) => [value.name, value.value])
  const headers = Object.fromEntries(entries)
  return headers
}
