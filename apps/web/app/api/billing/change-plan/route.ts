import { handler, readJson } from "@/app/api/handler"
import { changePlan } from "@/usecases/billing"

export const POST = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const plan = await changePlan(caller, input.value)
  return plan
})
