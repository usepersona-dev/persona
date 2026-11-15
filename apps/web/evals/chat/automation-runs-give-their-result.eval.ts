import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { waitFor } from "@/evals/shared"
import type { Caller } from "@/usecases/auth"
import { createAutomation, listRuns } from "@/usecases/automations"
import { addNote } from "@/usecases/notes"

type Test = Parameters<Parameters<typeof defineEval<typeof config>>[0]["test"]>[0]

// An automation runs on its own with nobody in a chat: it gives what came of it and whether it's worth telling the person, and the run keeps both. A run with nothing new isn't worth telling, so its chat isn't disturbed. Locally the queue hands nothing over, so the eval starts each run the way the queue's consumer does
export default defineEval<typeof config>({
  description: "An automation run gives what came of it, and only a run with something new is worth telling the person.",
  tags: ["chat", "automations"],
  async test(t) {
    const { caller, personaId } = await t.context.makePersona()
    const noted = await addNote(caller, personaId, { title: "Eval: alerts", content: "No alerts today." })
    if (!noted.ok) throw new Error(noted.error.message)

    // Two one-time automations, due two seconds from now: one has something to tell, the other has nothing new
    const at = new Date(Date.now() + 2000).toISOString()
    const fact = await createAutomation(caller, personaId, { name: "Eval: moon fact", prompt: "Find one short fact about the moon and tell me.", at })
    if (!fact.ok) throw new Error(fact.error.message)
    const quiet = await createAutomation(caller, personaId, { name: "Eval: alerts", prompt: "Read my note \"Eval: alerts\". If it lists an alert, tell me about it.", at })
    if (!quiet.ok) throw new Error(quiet.error.message)
    await t.sleep(2500)

    await t.target.dispatchSchedule("start")
    await startRun(t, caller, fact.value.id)
    await startRun(t, caller, quiet.value.id)

    const factRun = await endedRun(t, caller, fact.value.id)
    t.log(`moon fact run ${factRun?.status}, notify ${factRun?.result?.notify}: ${factRun?.result?.summary ?? ""}`)
    t.check(factRun?.status, satisfies((status) => status === "completed", "the moon fact run completes"))
    t.check(factRun?.result?.summary, satisfies((text) => String(text ?? "").trim().length > 0, "the moon fact run says what came of it"))
    t.check(factRun?.result?.notify, satisfies((notify) => notify === true, "the moon fact is worth telling the person"))

    const quietRun = await endedRun(t, caller, quiet.value.id)
    t.log(`alerts run ${quietRun?.status}, notify ${quietRun?.result?.notify}: ${quietRun?.result?.summary ?? ""}`)
    t.check(quietRun?.status, satisfies((status) => status === "completed", "the alerts run completes"))
    t.check(quietRun?.result?.notify, satisfies((notify) => notify === false, "the alerts run, with nothing new, isn't worth telling"))
  },
})

// The start tick claimed the automation's run; its route starts it, called with the secret as the queue's consumer calls it
async function startRun(t: Test, caller: Caller, automationId: string) {
  const claimed = await waitFor(async () => {
    const runs = await listRuns(caller, automationId)
    const run = runs.ok ? runs.value[0] : undefined
    return run
  }, 60_000)
  await t.require(claimed, satisfies((run) => run !== undefined, "the start tick claims a run"))

  const url = new URL(`/eve/v1/automations/${automationId}/${claimed!.id}`, t.target.url)
  const started = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  t.check(started.status, satisfies((status) => status === 202, "the run route starts the run"))
}

async function endedRun(t: Test, caller: Caller, automationId: string) {
  const ended = await waitFor(async () => {
    const runs = await listRuns(caller, automationId)
    const run = runs.ok ? runs.value.find((item) => item.status !== "running" && item.sessionId) : undefined
    return run
  }, 5 * 60_000)
  await t.require(ended, satisfies((run) => run !== undefined, "the run ends"))
  return ended
}
