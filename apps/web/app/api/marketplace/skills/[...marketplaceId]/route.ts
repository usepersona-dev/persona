import { handler } from "@/app/api/handler"
import { previewMarketplaceSkill } from "@/usecases/skills"

type Params = { marketplaceId: string[] }

export const GET = handler<Params>(async (caller, { marketplaceId }) => {
  const skill = await previewMarketplaceSkill(marketplaceId.join("/"))
  return skill
})
