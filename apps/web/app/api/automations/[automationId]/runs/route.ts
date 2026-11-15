import { handler } from "@/app/api/handler"
import { listRuns } from "@/usecases/automations"

type Params = { automationId: string }

export const GET = handler<Params>(async (caller, { automationId }, request) => {
  const url = new URL(request.url)
  const limit = url.searchParams.get("limit")
  const input = limit ? { limit: Number(limit) } : {}

  const runs = await listRuns(caller, automationId, input)
  return runs
})
