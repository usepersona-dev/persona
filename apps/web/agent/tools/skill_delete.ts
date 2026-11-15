import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { listSkills, removeSkill } from "@/usecases/skills"

export default defineTool({
  description: "Delete a skill for good. To set one aside instead, turn it off with skill_toggle.",
  inputSchema: z.object({ name: z.string().min(1) }),
  label: { start: ({ name }) => `Delete skill ${name}` },
  async execute({ name }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listSkills(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const skill = listed.value.find((item) => item.name === name)
    if (!skill) throw new Error(`There is no skill named "${name}".`)

    const removed = await removeSkill(caller, skill.id)
    if (!removed.ok) throw new Error(removed.error.message)
    const result = { name, deleted: true }
    return result
  },
})
