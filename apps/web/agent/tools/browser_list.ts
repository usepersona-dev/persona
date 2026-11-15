import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { listBrowsersWithTask } from "@/usecases/browser-use"

export default defineTool({
  description: "The person's open browsers: id, the task it was opened for, whether it is working, and when it opened. Use it to find a browser to continue or close.",
  inputSchema: z.object({}),
  label: { start: () => "List the browsers" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listBrowsersWithTask(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    const result = { browsers: listed.value }
    return result
  },
})
