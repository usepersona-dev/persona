import { createHash } from "node:crypto"

import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { addCredential, setCredentialValues } from "@/usecases/vault"

// A vault field named like an environment variable is that variable in every sandbox command. The agent proves it read the right value through its hash, and the value itself appears nowhere in the session
export default defineEval<typeof config>({
  description: "A sandbox command reads a vault variable, and the value appears nowhere in the session.",
  tags: ["vault"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const secret = marker("key")
    const hash = createHash("sha256").update(secret).digest("hex")

    const added = await addCredential(caller, personaId, { title: "Eval API", description: "The key for the eval's imaginary API.", fields: [{ name: "EVAL_API_KEY", secret: true }] })
    if (!added.ok) throw new Error(added.error.message)
    const filled = await setCredentialValues(caller, added.value.id, { EVAL_API_KEY: secret })
    if (!filled.ok) throw new Error(filled.error.message)

    const turn = await t.send(`Run printf %s "$EVAL_API_KEY" | sha256sum in your sandbox and tell me the hash it prints.`, { headers })
    t.succeeded()
    t.calledTool("bash")
    t.check(said(turn), satisfies((text) => String(text).includes(hash), "the answer carries the hash of the vault value"))
    t.eventsSatisfy("the vault value appears in no tool input, no tool output and no message", (events) => !JSON.stringify(events).includes(secret))
  },
})
