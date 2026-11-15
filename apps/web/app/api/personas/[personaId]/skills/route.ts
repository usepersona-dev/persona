import { handler, readJson } from "@/app/api/handler"
import { addSkill, listSkills } from "@/usecases/skills"

type Params = { personaId: string }

export const GET = handler<Params>(async (caller, { personaId }) => {
  const skills = await listSkills(caller, personaId)
  return skills
})

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const skill = await addSkill(caller, personaId, input.value)
  return skill
})
