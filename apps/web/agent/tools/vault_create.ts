import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { addCredential, createCollectLink } from "@/usecases/vault"

export default defineTool({
  description: "Set up a credential in the vault when the person wants to hand you a login, a card, an API key or the like: name it, say when it is the one to use, and list its fields, marking which are secret. It holds no values. It returns a link the person opens to fill them in themselves: send it on exactly as it is, with until when it works. Never ask for a value in chat and never put one here.",
  inputSchema: z.object({
    title: z.string().trim().min(1).max(120).describe("Short, as the person would call it: Gym login, Company card."),
    description: z.string().trim().min(1).max(1000).describe("When this credential is the one to use, written for you."),
    fields: z.array(z.object({ name: z.string().trim().min(1).max(64).describe("What the field is called: email, password, card number. When a command will read it as an environment variable, name it exactly as that command expects, such as OPENAI_API_KEY: only fields named like that reach your sandbox, as that variable."), secret: z.boolean().describe("true for anything that must stay hidden: a password, a card number, a key.") })).min(1).max(30),
  }),
  label: { start: ({ title }) => `Set up ${title} in the vault` },
  async execute({ title, description, fields }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const added = await addCredential(caller, personaId, { title, description, fields })
    if (!added.ok) throw new Error(added.error.message)
    const credential = added.value

    const link = await createCollectLink(caller, credential.id)
    if (!link.ok) throw new Error(link.error.message)

    const result = { id: credential.id, title: credential.title, fields: credential.fields.map((field) => ({ name: field.name, secret: field.secret })), link: link.value.url, linkExpiresAt: link.value.expiresAt }
    return result
  },
})
