import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { listCredentials } from "@/usecases/vault"

export default defineTool({
  description: "What the vault holds: each credential's id, title, when it is the one to use, and its fields with whether each is a secret and whether it has been filled in yet. Never a value.",
  inputSchema: z.object({}),
  label: { start: () => "List the vault" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listCredentials(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const credentials = listed.value

    const result = { credentials: credentials.map((credential) => ({ id: credential.id, title: credential.title, description: credential.description, fields: credential.fields.map((field) => ({ name: field.name, secret: field.secret, filled: credential.filled.includes(field.name) })) })) }
    return result
  },
})
