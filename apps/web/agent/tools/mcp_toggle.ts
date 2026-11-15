import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { listConnections, updateConnection } from "@/usecases/connections"

export default defineTool({
  description: "Turn an MCP server off without losing its settings, or back on. One that is off offers you no tools until it is on again.",
  inputSchema: z.object({ name: z.string().min(1), enabled: z.boolean() }),
  label: { start: ({ name, enabled }) => `${enabled ? "Turn on" : "Turn off"} MCP server ${name}` },
  async execute({ name, enabled }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listConnections(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const connection = listed.value.find((item) => item.name === name)
    if (!connection) throw new Error(`There is no MCP server named "${name}". Check mcp_list.`)

    const updated = await updateConnection(caller, connection.id, { enabled })
    if (!updated.ok) throw new Error(updated.error.message)

    const result = { name: updated.value.name, enabled: updated.value.enabled }
    return result
  },
})
