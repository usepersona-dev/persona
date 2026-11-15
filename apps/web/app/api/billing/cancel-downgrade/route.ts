import { handler } from "@/app/api/handler"
import { cancelDowngrade } from "@/usecases/billing"

export const POST = handler(async (caller) => {
  const plan = await cancelDowngrade(caller)
  return plan
})
