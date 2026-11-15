import { handler, readJson } from "@/app/api/handler"
import { getBilling, updateAutoReload } from "@/usecases/billing"

export const GET = handler(async (caller) => {
  const billing = await getBilling(caller)
  return billing
})

export const PATCH = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const saved = await updateAutoReload(caller, input.value)
  return saved
})
