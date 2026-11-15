import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { listRuns } from "@/usecases/automations"

export default defineTool({
  description: "How one automation has been going: its latest runs, newest first, with what each wrote. Take the id from automation_list.",
  inputSchema: z.object({
    id: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional().describe("How many of the latest runs to read back. Defaults to 10."),
  }),
  label: { start: () => "Read automation runs" },
  async execute({ id, limit }, ctx) {
    const { caller } = readCaller(ctx)

    const listed = await listRuns(caller, id, { limit: limit ?? 10 })
    if (!listed.ok) throw new Error(listed.error.message)
    const runs = listed.value

    const result = { runs: runs.map((run) => ({ scheduledFor: run.scheduledFor, status: run.status, result: run.result, endedAt: run.endedAt })) }
    return result
  },
})
