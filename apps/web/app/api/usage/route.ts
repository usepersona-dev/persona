import { handler } from "@/app/api/handler"
import { listUsage } from "@/usecases/credits"

export const GET = handler(async (caller, params, request) => {
  const search = new URL(request.url).searchParams
  const from = search.get("from") ?? ""
  const to = search.get("to") ?? ""
  const unit = search.get("unit") ?? ""
  const timeZone = search.get("timeZone") ?? ""

  const span = { from, to, unit, timeZone }
  const usage = await listUsage(caller, span)
  return usage
})
