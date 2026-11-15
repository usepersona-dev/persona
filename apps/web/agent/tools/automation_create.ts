import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { createAutomation } from "@/usecases/automations"

export default defineTool({
  description: "Schedule yourself to do something later: once at a date and time, or again and again on a cron schedule. Give exactly one of at or cron. Nobody will be there to explain the task when it runs, so write the prompt as the whole task, with everything you would otherwise ask for. Confirm the person's timezone before you convert a time. What you write when it runs is kept on the run, and automation_runs reads it back.",
  inputSchema: z.object({
    name: z.string().trim().min(1).max(80).describe("A short title, such as Monday plan, so it can be told apart from the others."),
    prompt: z.string().trim().min(1).max(20_000).describe("The whole task, written to yourself."),
    at: z.iso.datetime({ offset: true }).optional().describe("For a one-time run: a date and time with its offset, such as 2026-10-06T09:00:00+03:00."),
    cron: z.string().optional().describe("For a repeating run: minute, hour, day of the month, month and day of the week, such as 0 9 * * 1 for Mondays at 9."),
    timezone: z.string().optional().describe("The IANA timezone the cron runs in, such as Asia/Jerusalem. Defaults to UTC."),
  }),
  label: { start: ({ name }) => `Schedule ${name}` },
  async execute({ name, prompt, at, cron, timezone }, ctx) {
    const { caller, personaId, linkId } = readCaller(ctx)

    const created = await createAutomation(caller, personaId, { name, prompt, at, cron, timezone, linkId })
    if (!created.ok) throw new Error(created.error.message)
    const automation = created.value

    const result = { id: automation.id, name: automation.name, at: automation.at, cron: automation.cron, timezone: automation.timezone, enabled: automation.enabled }
    return result
  },
})
