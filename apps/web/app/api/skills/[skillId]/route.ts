import { handler, readJson } from "@/app/api/handler"
import { getSkill, removeSkill, updateSkill } from "@/usecases/skills"

type Params = { skillId: string }

export const GET = handler<Params>(async (caller, { skillId }) => {
  const skill = await getSkill(caller, skillId)
  return skill
})

export const PATCH = handler<Params>(async (caller, { skillId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const skill = await updateSkill(caller, skillId, input.value)
  return skill
})

export const DELETE = handler<Params>(async (caller, { skillId }) => {
  const removed = await removeSkill(caller, skillId)
  return removed
})
