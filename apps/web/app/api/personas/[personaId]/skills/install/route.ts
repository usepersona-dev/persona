import { handler, readJson } from "@/app/api/handler"
import { installMarketplaceSkill } from "@/usecases/skills"

type Params = { personaId: string }

export const POST = handler<Params>(async (caller, { personaId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const skill = await installMarketplaceSkill(caller, personaId, input.value.marketplaceId)
  return skill
})
