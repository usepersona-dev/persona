import { defineTool } from "eve/tools"
import { z } from "zod"

import { VAULT_FILE } from "@/agent/sandbox"
import { readCaller } from "@/usecases/agent"
import { readVaultVariables } from "@/usecases/vault"
import { SandboxSession } from "eve/sandbox"

export default defineTool({
  description: `Load the vault into your sandbox again after the person fills something in. The sandbox loads it by itself when it starts. Each field named like an environment variable, such as OPENAI_API_KEY, is that variable in every command; use it as "$OPENAI_API_KEY". Never print, echo or log a value. It returns the variable names, never a value.`,
  inputSchema: z.object({}),
  label: { start: () => "Load the vault" },
  async execute(_input, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const variables = await readVaultVariables(caller, personaId)
    if (!variables.ok) throw new Error(variables.error.message)

    const sandbox = await ctx.getSandbox()
    await writeVault(sandbox, variables.value)

    // Only the names go back to the model, never a value
    const result = { file: VAULT_FILE, variables: variables.value.map((variable) => variable.name) }
    return result
  },
})


async function writeVault(sandbox: Pick<SandboxSession, "writeTextFile">, variables: readonly { name: string; value: string }[]) {
  const lines = variables.map((variable) => `export ${variable.name}='${variable.value.replaceAll("'", "'\\''")}'`)
  await sandbox.writeTextFile({ path: VAULT_FILE, content: lines.join("\n") })
}