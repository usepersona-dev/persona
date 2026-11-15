import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { createCollectLink } from "@/usecases/vault"

export default defineTool({
  description: "A fresh link the person opens to fill a credential's fields in themselves, so no value ever passes through the conversation. vault_create already gives you one; use this when that link has run out or got lost. Send it on exactly as it is, with until when it works. A field they leave blank keeps what the vault already holds.",
  inputSchema: z.object({ credentialId: z.string().min(1).describe("The credential's id from vault_list or vault_create.") }),
  label: { start: () => "Make a vault link" },
  async execute({ credentialId }, ctx) {
    const { caller } = readCaller(ctx)

    const link = await createCollectLink(caller, credentialId)
    if (!link.ok) throw new Error(link.error.message)

    const result = { url: link.value.url, expiresAt: link.value.expiresAt }
    return result
  },
})
