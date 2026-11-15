import { handler } from "@/app/api/handler"
import { searchSkillMarketplace } from "@/usecases/skills"

export const GET = handler(async (caller, params, request) => {
  const url = new URL(request.url)
  const query = url.searchParams.get("query") ?? ""

  const skills = await searchSkillMarketplace(query)
  return skills
})
