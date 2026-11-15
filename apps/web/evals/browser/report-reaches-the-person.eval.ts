import { setTimeout as sleep } from "node:timers/promises"

import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, waitFor } from "@/evals/shared"
import { createAutomation, listRuns } from "@/usecases/automations"
import { addCredential, setCredentialValues } from "@/usecases/vault"

// An automation is worth something only when its answer reaches the person: the run's result is what they are sent, so what the browser found has to end up there
export default defineEval<typeof config>({
  description: "What the browser found in an automation ends up in the run's result.",
  tags: ["browser"],
  async test(t) {
    const { caller, personaId } = await t.context.makePersona()

    // Signing in takes the browser; quotes.toscrape.com takes any login
    const added = await addCredential(caller, personaId, { title: "Quotes login", description: "The login for quotes.toscrape.com.", fields: [{ name: "username", secret: false }, { name: "password", secret: true }] })
    if (!added.ok) throw new Error(added.error.message)
    const filled = await setCredentialValues(caller, added.value.id, { username: marker("reader"), password: marker("swordfish") })
    if (!filled.ok) throw new Error(filled.error.message)

    // A one-time automation must be set in the future, so it is due two seconds from now
    const at = new Date(Date.now() + 2000).toISOString()
    const created = await createAutomation(caller, personaId, { name: "Eval: sign in", prompt: "Sign in to https://quotes.toscrape.com/login with my Quotes login from the vault, then tell me what the link at the top right of the page says.", at })
    if (!created.ok) throw new Error(created.error.message)
    await sleep(2500)

    // The start tick claims the run, and its route starts it, called with the secret as the queue's consumer calls it: locally the queue hands nothing over
    await t.target.dispatchSchedule("start")
    const claimed = await waitFor(async () => {
      const runs = await listRuns(caller, created.value.id)
      const run = runs.ok ? runs.value[0] : undefined
      return run
    }, 60_000)
    await t.require(claimed, satisfies((run) => run !== undefined, "the start tick claims a run"))

    const url = new URL(`/eve/v1/automations/${created.value.id}/${claimed!.id}`, t.target.url)
    const started = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
    t.check(started.status, satisfies((status) => status === 202, "the run route starts the run"))

    const ended = await waitFor(async () => {
      const runs = await listRuns(caller, created.value.id)
      const run = runs.ok ? runs.value.find((item) => item.status !== "running") : undefined
      return run
    }, 9 * 60_000)

    const result = ended?.result as { summary?: string } | null | undefined
    const summary = result?.summary ?? ""
    t.log(`run ${ended?.status ?? "never ended"}: ${summary}`)
    t.check(summary, satisfies((text) => /logout/i.test(String(text)), "the run's result carries what the browser found"))
  },
})
