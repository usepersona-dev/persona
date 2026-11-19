import { defineHook } from "eve/hooks"

import { savePersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listConnections } from "@/usecases/connections"
import { listInstructions } from "@/usecases/instructions"
import { getPersona } from "@/usecases/personas"
import { listTools } from "@/usecases/tools"

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const { caller, personaId } = readCaller(ctx)
      const [persona, tools, instructions, connections] = await Promise.all([
        getPersona(caller, personaId),
        listTools(caller, personaId),
        listInstructions(caller, personaId),
        listConnections(caller, personaId)
      ])

      if (!persona.ok) throw new Error(persona.error.message)
      if (!tools.ok) throw new Error(tools.error.message)
      if (!instructions.ok) throw new Error(instructions.error.message)
      if (!connections.ok) throw new Error(connections.error.message)

      const enabledInstructions = instructions.value
        .filter((instruction) => instruction.enabled)
        .map((instruction) => ({ name: instruction.name, content: instruction.content }))

      const enabledConnections = connections.value
        .filter((connection) => connection.enabled)
        .map((connection) => ({ id: connection.id, name: connection.name, url: connection.url, description: connection.description }))

      savePersonaState({
        name: persona.value.name,
        models: persona.value.models,
        tools: tools.value,
        instructions: enabledInstructions,
        connections: enabledConnections
      })
    },
  },
})
