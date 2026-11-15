import { handler, readJson } from "@/app/api/handler"
import { buyCredits } from "@/usecases/billing"

export const POST = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const bought = await buyCredits(caller, input.value)
  return bought
})
