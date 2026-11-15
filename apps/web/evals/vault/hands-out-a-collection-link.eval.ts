import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { listCredentials } from "@/usecases/vault"

// The promise: a password is never typed into the conversation. The agent sets the credential up empty and sends a link, and the link has to be a page the person can open
export default defineEval<typeof config>({
  description: "Asked to keep a login, the agent sets up the credential and sends a collection link.",
  tags: ["vault"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const title = marker("Acme")

    const turn = await t.send(`I want you to keep my ${title} login for me. Set it up in my vault under exactly that title, with a username field and a password field, and send me the link to fill it in. Don't ask me for the password here.`, { headers })
    t.succeeded()
    t.calledTool("vault_create")

    const listed = await listCredentials(caller, personaId)
    const credential = listed.ok ? listed.value.find((item) => item.title === title) : undefined
    await t.require(credential, satisfies((value) => value !== undefined, "the vault holds a credential with that title"))
    const names = credential?.fields.map((field) => field.name.toLowerCase()) ?? []
    t.check(names, satisfies((list) => Array.isArray(list) && list.includes("username") && list.includes("password"), "it asks for a username and a password"))
    t.check(credential?.fields.find((field) => field.name.toLowerCase() === "password")?.secret, satisfies((secret) => secret === true, "the password field is secret"))

    // The link counts only when it reaches the person, so it is read back out of the reply
    const url = /https?:\/\/\S+\/collect\/[\w.-]+/.exec(said(turn))?.[0]
    await t.require(url, satisfies((value) => typeof value === "string", "the reply carries a collection link"))

    // Soft: the collection page is not built yet (roadmap item 34), and no web app runs during evals
    const status = await fetch(String(url)).then((page) => page.status).catch(() => 0)
    t.check(status, satisfies((code) => code === 200, "the collection page opens")).soft()
  },
})
