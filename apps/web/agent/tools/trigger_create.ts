import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { createTrigger } from "@/usecases/triggers"

export default defineTool({
  description: "Make yourself a trigger: one of your connected apps tells you when something happens, such as a new email or a meeting about to start. Its events wait five minutes from the first, then the task runs once for all of them, each attached as a file. Find the triggers and their settings with trigger_types, and narrow the settings so only the events worth a run come. Nobody will be there to explain the task when it runs, so write the prompt as the whole task.",
  inputSchema: z.object({
    name: z.string().trim().min(1).max(80).describe("A short title, such as Meeting soon, so it can be told apart from the others."),
    prompt: z.string().trim().min(1).max(20_000).describe("What to do with the events, written to yourself."),
    slug: z.string().trim().min(1).describe("The trigger, from trigger_types, such as GOOGLECALENDAR_EVENT_STARTING_SOON_TRIGGER."),
    settings: z.record(z.string(), z.unknown()).optional().describe("The trigger's settings, from trigger_types."),
    accountId: z.string().min(1).optional().describe("Which connected account to watch, when you have more than one for that app."),
  }),
  label: { start: ({ name }) => `Make trigger ${name}` },
  async execute({ name, prompt, slug, settings, accountId }, ctx) {
    const { caller, personaId, linkId } = readCaller(ctx)

    const created = await createTrigger(caller, personaId, { name, prompt, linkId, slug, config: settings, accountId })
    if (!created.ok) throw new Error(created.error.message)
    const trigger = created.value

    const result = { id: trigger.id, name: trigger.name, slug: trigger.slug, accountId: trigger.accountId }
    return result
  },
})
