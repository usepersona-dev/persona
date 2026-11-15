import { defineDynamic, defineSkill } from "eve/skills"

import { readCaller } from "@/usecases/agent"
import { getSkills } from "@/usecases/skills"

type SkillFile = { path: string; contents: string }

export default defineDynamic(async (ctx) => {
  const { caller, personaId } = readCaller(ctx)

  const skills = await getSkills(caller, personaId, { enabled: true })
  if (!skills.ok) throw new Error(skills.error.message)
  if (skills.value.length === 0) return null

  const entries: [string, ReturnType<typeof defineSkill>][] = skills.value.map((skill) => [skill.name, defineSkill({ description: skill.description, content: skill.markdown, files: toFiles(skill.files) })])
  const result = Object.fromEntries(entries)
  return result
})

function toFiles(files: readonly SkillFile[]) {
  const entries = files.map((file) => [file.path, file.contents])
  const result = Object.fromEntries(entries)
  return result
}
