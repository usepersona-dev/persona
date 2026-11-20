import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listConnections } from "@/usecases/connections"

export const mcpList = (deferred = false) => defineTool({
  deferred,
  description: "List the MCP servers you can reach, whether each is on and what it is for. Header values stay secret; only their names come back. Read it before changing or removing one.",
  inputSchema: z.object({}),
  label: { start: () => "List MCP servers" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listConnections(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const connections = listed.value

    const result = { servers: connections.map((connection) => ({ name: connection.name, url: connection.url, description: connection.description, enabled: connection.enabled, headers: connection.headers })) }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.mcp
  if (!family.enabled) return null
  return mcpList(family.deferred)
})
