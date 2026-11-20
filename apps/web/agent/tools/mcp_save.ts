import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { addConnection, listConnections, updateConnection } from "@/usecases/connections"

export const mcpSave = (deferred = false) => defineTool({
  deferred,
  description: "Add an MCP server so its tools become yours from the next turn on, or change one by saving under its name. Apps such as Gmail or Slack are connected through your apps connection instead, not here.",
  inputSchema: z.object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, digits and dashes, starting with a letter, such as acme-internal.").max(64),
    url: z.url().describe("The server's MCP address."),
    description: z.string().trim().min(1).max(1000).describe("What the server is for, written for you: you'll read it when deciding whether to use the server."),
    headers: z.object({}).catchall(z.string()).optional().describe("Anything the server needs on every request, such as an Authorization header. Values are kept secret."),
  }),
  label: { start: ({ name }) => `Save MCP server ${name}` },
  async execute({ name, url, description, headers }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listConnections(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const existing = listed.value.find((connection) => connection.name === name)
    const saved = existing ? await updateConnection(caller, existing.id, { url, description, headers }) : await addConnection(caller, personaId, { name, url, description, headers })
    if (!saved.ok) throw new Error(saved.error.message)

    const result = { name: saved.value.name, enabled: saved.value.enabled, headers: saved.value.headers }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.mcp
  if (!family.enabled) return null
  return mcpSave(family.deferred)
})
