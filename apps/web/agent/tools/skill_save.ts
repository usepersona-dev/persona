import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { addSkill, listSkills, updateSkill } from "@/usecases/skills"

export default defineTool({
  description: "Save a procedure as a skill you can load later, or revise one by saving it under the same name. The description is all you see until you load the skill, so say when to reach for it, and put the whole procedure in the markdown. Longer material goes in files, read from the skill's folder.",
  inputSchema: z.object({
    name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes, such as plan-a-trip.").max(64),
    description: z.string().trim().min(1).max(1024).describe("When to use the skill, written for you."),
    markdown: z.string().min(1).max(200_000).describe("The whole procedure."),
    files: z.array(z.object({ path: z.string().min(1).describe("A relative path, such as references/checklist.md."), contents: z.string() })).max(50).optional().describe("Supporting files the procedure points to."),
  }),
  label: { start: ({ name }) => `Save skill ${name}` },
  async execute({ name, description, markdown, files }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listSkills(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const existing = listed.value.find((skill) => skill.name === name)
    const saved = existing ? await updateSkill(caller, existing.id, { description, markdown, files }) : await addSkill(caller, personaId, { name, description, markdown, files }, "agent")
    if (!saved.ok) throw new Error(saved.error.message)

    const result = { name: saved.value.name, enabled: saved.value.enabled }
    return result
  },
})
