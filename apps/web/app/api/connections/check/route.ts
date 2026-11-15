import { handler, readJson } from "@/app/api/handler"
import { checkConnection } from "@/usecases/connections"

export const POST = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const check = await checkConnection(caller, input.value)
  return check
})
