import { DefaultSandbox, defineSandbox, type SandboxSession } from "eve/sandbox"

import { readCaller } from "@/usecases/agent"
import { readVaultVariables } from "@/usecases/vault"

export const VAULT_FILE = "/workspace/.vault.env"

export const environment = DefaultSandbox.environment({
  vercel: { timeout: 5 * 60 * 1_000, keepLastSnapshots: { count: 1 }, resources: { vcpus: 1 } },
  prepare: prepare
})

export default defineSandbox(async (ctx) => {
  const { caller, personaId } = readCaller(ctx)
  const sandbox = await environment.open()

  const variables = await readVaultVariables(caller, personaId)
  if (!variables.ok) throw new Error(variables.error.message)
  await writeVault(sandbox, variables.value)

  return sandbox
})

async function writeVault(sandbox: Pick<SandboxSession, "writeTextFile">, variables: readonly { name: string; value: string }[]) {
  const lines = variables.map((variable) => `export ${variable.name}='${variable.value.replaceAll("'", "'\\''")}'`)
  await sandbox.writeTextFile({ path: VAULT_FILE, content: lines.join("\n") })
}

async function prepare(sandbox: Pick<SandboxSession, "run">) {
  const profile = await sandbox.run({ command: `echo '[ -f ${VAULT_FILE} ] && . ${VAULT_FILE}' >> ~/.profile` })
  if (profile.exitCode !== 0) throw new Error(`Could not set up the vault in the sandbox: ${profile.stderr}`)

  const tools = await sandbox.run({ command: "sudo apt-get update -qq && sudo apt-get install -y -qq --no-install-recommends python3-pip && npm install -g pnpm@11.5.2" })
  if (tools.exitCode !== 0) throw new Error(`Could not install pip and pnpm in the sandbox: ${tools.stderr}`)
}