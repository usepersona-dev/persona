import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { addCredential, setCredentialValues } from "@/usecases/vault"

// Signing in takes a real page, so the main agent hands it to the browser, which types the login from the vault without any model seeing the password. quotes.toscrape.com takes any login, so the password can be a word nothing else would write
export default defineEval<typeof config>({
  description: "Asked to sign in with a vault login, the agent hands browser_task the credential for quotes.toscrape.com, and the password appears nowhere.",
  tags: ["browser", "vault"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const password = marker("swordfish")

    const added = await addCredential(caller, personaId, { title: "Quotes login", description: "The login for quotes.toscrape.com.", fields: [{ name: "username", secret: false }, { name: "password", secret: true }] })
    if (!added.ok) throw new Error(added.error.message)
    const filled = await setCredentialValues(caller, added.value.id, { username: marker("reader"), password })
    if (!filled.ok) throw new Error(filled.error.message)

    const turn = await t.send("Sign in to https://quotes.toscrape.com/login with my Quotes login from the vault, then tell me what the link at the top right of the page says.", { headers })
    t.succeeded()
    t.calledTool("browser_task", { input: { vault: (vault: unknown) => Array.isArray(vault) && vault.some((item) => item.credentialId === added.value.id && item.sites.some((site: string) => site.endsWith("quotes.toscrape.com"))) } })
    t.check(said(turn), satisfies((text) => /logout/i.test(String(text)), "the answer shows the page after the sign-in"))

    const leaked = JSON.stringify(turn.events).includes(password)
    t.check(leaked, satisfies((value) => value === false, "the password appears in no event of the agent"))
  },
})
