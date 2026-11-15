import { DefaultSandbox, defineSandbox, type SandboxSession } from "eve/sandbox"

import { readCaller } from "@/usecases/agent"
import { readVaultVariables } from "@/usecases/vault"

export const VAULT_FILE = "/workspace/.vault.env"

// Every command runs in a login shell, and the login profile loads the vault file when there is one
// Vercel keeps a snapshot of every stop for 30 days, and eve resumes only from the newest, so only that one is kept
// Since eve 0.84 the default image has no pip or pnpm, and personas' skills use both, so they go back in as eve 0.83.3's image had them
// 1 vCPU with 2 GB: sandboxes sit idle almost all the time, Vercel bills the memory, and each start takes half as much of Vercel's vCPU start rate
export const environment = DefaultSandbox.environment({
  vercel: { timeout: 5 * 60 * 1_000, keepLastSnapshots: { count: 1 }, resources: { vcpus: 1 } },
  prepare: async (sandbox) => {
    const profile = await sandbox.run({ command: `echo '[ -f ${VAULT_FILE} ] && . ${VAULT_FILE}' >> ~/.profile` })
    if (profile.exitCode !== 0) throw new Error(`Could not set up the vault in the sandbox: ${profile.stderr}`)

    const tools = await sandbox.run({ command: "sudo apt-get update -qq && sudo apt-get install -y -qq --no-install-recommends python3-pip && npm install -g pnpm@11.5.2" })
    if (tools.exitCode !== 0) throw new Error(`Could not install pip and pnpm in the sandbox: ${tools.stderr}`)
  },
})

// Each session's sandbox opens with the persona's vault already in it
export default defineSandbox(async (ctx) => {
  const { caller, personaId } = readCaller(ctx)
  const sandbox = await environment.open()

  const variables = await readVaultVariables(caller, personaId)
  if (!variables.ok) throw new Error(variables.error.message)
  await writeVault(sandbox, variables.value)

  return sandbox
})

/** Writes the vault file: one export line per variable, each value quoted for the shell. */
export async function writeVault(sandbox: Pick<SandboxSession, "writeTextFile">, variables: readonly { name: string; value: string }[]) {
  const lines = variables.map((variable) => `export ${variable.name}='${variable.value.replaceAll("'", "'\\''")}'`)
  await sandbox.writeTextFile({ path: VAULT_FILE, content: lines.join("\n") })
}
