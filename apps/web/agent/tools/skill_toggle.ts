import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { listSkills, updateSkill } from "@/usecases/skills"

export const skillToggle = (deferred = false) => defineTool({
  deferred,
  description: "Turn a skill off without losing it, or back on. A skill that is off isn't offered to you until it is on again.",
  inputSchema: z.object({ name: z.string().min(1), enabled: z.boolean() }),
  label: { start: ({ name, enabled }) => `${enabled ? "Turn on" : "Turn off"} skill ${name}` },
  async execute({ name, enabled }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listSkills(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const skill = listed.value.find((item) => item.name === name)
    if (!skill) throw new Error(`There is no skill named "${name}".`)

    const updated = await updateSkill(caller, skill.id, { enabled })
    if (!updated.ok) throw new Error(updated.error.message)

    const result = { name: updated.value.name, enabled: updated.value.enabled }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.skill
  if (!family.enabled) return null
  return skillToggle(family.deferred)
})
