import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listConnections, removeConnection } from "@/usecases/connections"

export const mcpDelete = (deferred = false) => defineTool({
  deferred,
  description: "Remove an MCP server for good, with its tools and its saved headers. To set one aside instead, turn it off with mcp_toggle.",
  inputSchema: z.object({ name: z.string().min(1) }),
  label: { start: ({ name }) => `Delete MCP server ${name}` },
  async execute({ name }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listConnections(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const connection = listed.value.find((item) => item.name === name)
    if (!connection) throw new Error(`There is no MCP server named "${name}". Check mcp_list.`)

    const removed = await removeConnection(caller, connection.id)
    if (!removed.ok) throw new Error(removed.error.message)
    const result = { name, deleted: true }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.mcp
  if (!family.enabled) return null
  return mcpDelete(family.deferred)
})
