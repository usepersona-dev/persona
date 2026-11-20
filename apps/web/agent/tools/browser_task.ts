import { defineDynamic, defineWorkflowTool, type WorkflowStepToolContext, type WorkflowToolContext } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { ok } from "@/lib/errors"
import { readCaller } from "@/usecases/agent"
import { createBrowserWithTask, getBrowserAndTask, stopBrowserAndTask, updateBrowserAndTask } from "@/usecases/browser-use"
import { readVaultSecrets } from "@/usecases/vault"

const POLL_MS = 2000
const STEP_MS = 20_000
const RUN_MS = 30 * 60_000

const inputSchema = z.object({
  task: z.string().trim().min(1).max(8000).describe("The whole task: the site, what to do and every detail it needs. In a follow-up, only the answer or the new instruction."),
  browserId: z.string().optional().describe("To continue in an open browser, from an answer or browser_list. Leave it out to open a new one."),
  country: z.string().optional().describe("Only if we need a proxy: the country to browse from, as a two-letter code such as il."),
  vault: z.array(z.object({
    credentialId: z.string().describe("From vault_list."),
    sites: z.array(z.string()).describe("Bare hosts it may be typed on, such as wolt.com. For a card, add the payment provider's host."),
  })).optional().describe("Vault credentials it may type, such as a login or a card. Send them on every call that needs them. If one is missing, set it up with vault_create."),
})

export const browserTask = (deferred = false) => defineWorkflowTool({
  deferred,
  description: "Runs a task in a real web browser, in the background. The answer comes later as a task result, so tell the person you're on it. It stops before anything that can't be undone, such as an order or a payment, unless the task approves it with the merchant, the item and the total or a maximum. The answer has a status, a message and the browserId. Status: Done, Needs details, Needs a code, Needs a link, Needs a tap, Needs approval, Needs takeover, Blocked or Stopped. Only Needs takeover comes with a live link to the browser: the one time the person should see it, so send it with what they must do there, and never offer a live view otherwise. Get a code or sign-in link yourself when it went to an inbox you can read; otherwise ask the person. Send their answer or a change of mind with the same browserId.",
  inputSchema,
  label: { start: ({ browserId }) => (browserId ? "Go on in the browser" : "Open the browser") },
  task,
})

async function task(input: z.infer<typeof inputSchema>, ctx: WorkflowToolContext) {
  "use workflow"
  const started = await start(ctx, input)
  if (!started.ok) throw new Error(started.error.message)

  const { id, runId, startedAt, missing } = started.value
  let answer = await wait(ctx, id, runId, startedAt)
  while (!answer) answer = await wait(ctx, id, runId, startedAt)
  return missing.length ? { ...answer, notInVault: missing } : answer
}

async function start(ctx: WorkflowStepToolContext, input: z.infer<typeof inputSchema>) {
  "use step"
  const { caller, personaId } = readCaller(ctx)
  const { browserId, ...rest } = input

  const secrets = await readVaultSecrets(caller, personaId, rest.vault?.map((item) => item.credentialId) ?? [])
  if (!secrets.ok) return secrets

  const { found, missing } = secrets.value
  const opened = browserId ? await updateBrowserAndTask(caller, personaId, browserId, rest, found) : await createBrowserWithTask(caller, personaId, rest, found)
  if (!opened.ok) return opened
  return ok({ ...opened.value, missing, startedAt: Date.now() })
}

async function wait(ctx: WorkflowStepToolContext, browserId: string, runId: string, startedAt: number) {
  "use step"
  const { caller, personaId } = readCaller(ctx)

  const stepEndsAt = Date.now() + STEP_MS

  while (Date.now() < stepEndsAt) {
    if (ctx.abortSignal.aborted || Date.now() - startedAt > RUN_MS) {
      await stopBrowserAndTask(caller, personaId, browserId, runId)
      return { status: "Stopped", message: "It ran for 30 minutes without finishing, so it stopped where it got to. Send the task again to the same browser to go on.", browserId }
    }

    const answer = await getBrowserAndTask(caller, personaId, browserId, runId)
    if (!answer.ok) return { status: "Stopped", message: answer.error.message, browserId }
    if (answer.value.status !== "Working") return { ...answer.value, browserId }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  return null
}

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.browser
  if (!family.enabled) return null
  return browserTask(family.deferred)
})
