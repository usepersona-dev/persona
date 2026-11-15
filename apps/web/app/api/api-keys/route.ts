import { handler, readJson } from "@/app/api/handler"
import { createApiKey, listApiKeys } from "@/usecases/api-keys"

export const GET = handler(async (caller) => {
  const apiKeys = await listApiKeys(caller)
  return apiKeys
})

export const POST = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const created = await createApiKey(caller, input.value)
  return created
})
