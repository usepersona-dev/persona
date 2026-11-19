import { defineState } from "eve/context"

import type { PersonaModel } from "@/usecases/personas"
import type { Tools } from "@/usecases/tools"

type PersonaState = {
  name: string
  models: readonly PersonaModel[]
  tools: Tools
  instructions: { name: string; content: string }[]
  connections: { id: string; name: string; url: string; description: string }[]
}

const persona = defineState<PersonaState | null>("persona-state", () => null)

export function savePersonaState(loaded: PersonaState) {
  persona.update(() => loaded)
  return loaded
}

export function readPersonaState() {
  const loaded = persona.get()
  if (!loaded) throw new Error("This turn has no persona loaded.")
  return loaded
}
