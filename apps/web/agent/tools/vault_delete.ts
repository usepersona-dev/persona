import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { removeCredential } from "@/usecases/vault"

export const vaultDelete = (deferred = false) => defineTool({
  deferred,
  description: "Delete a credential from the vault for good, with every value it holds. Take the id from vault_list.",
  inputSchema: z.object({ id: z.string().min(1) }),
  label: { start: () => "Delete from the vault" },
  async execute({ id }, ctx) {
    const { caller } = readCaller(ctx)

    const removed = await removeCredential(caller, id)
    if (!removed.ok) throw new Error(removed.error.message)

    const result = { id, deleted: true }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.vault
  if (!family.enabled) return null
  return vaultDelete(family.deferred)
})
