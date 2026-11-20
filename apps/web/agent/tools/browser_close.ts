import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { removeBrowserAndTask } from "@/usecases/browser-use"

export const browserClose = (deferred = false) => defineTool({
  deferred,
  description: "Close a browser once its job is done. Whatever it is doing stops, and sign-ins stay saved.",
  inputSchema: z.object({ browserId: z.string().min(1) }),
  label: { start: () => "Close the browser" },
  async execute({ browserId }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const removed = await removeBrowserAndTask(caller, personaId, browserId)
    if (!removed.ok) throw new Error(removed.error.message)

    const result = { browserId, closed: true }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.browser
  if (!family.enabled) return null
  return browserClose(family.deferred)
})
