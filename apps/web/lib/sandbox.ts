import { Sandbox } from "@vercel/sandbox"

// The sandbox of an eve session, asked from Vercel by the sessionId tag eve puts on each sandbox it makes. eve can only open a session's sandbox, which starts or wakes one; this read never does. A session that never used a sandbox has none
export async function findSandbox(sessionId: string) {
  const { sandboxes } = await Sandbox.list({ tags: { sessionId }, limit: 1 })
  const sandbox = sandboxes.at(0)
  return sandbox
}

// One sandbox by its name, with Vercel's running totals of its time and CPU. It does not wake a stopped one
export async function readSandbox(name: string) {
  const sandbox = await Sandbox.get({ name })
  return sandbox
}
