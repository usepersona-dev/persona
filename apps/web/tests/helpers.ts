import { Autumn } from "autumn-js"
import { emptySessionView, foldEvents } from "eve/events"

import chatFile from "@/agent/tools/chat_file"
import chatReact from "@/agent/tools/chat_react"
import chatSay from "@/agent/tools/chat_say"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { createProject, removeProject } from "@/usecases/projects"

export type TestSandbox = { writeTextFile?: (options: { path: string; content: string }) => Promise<void>; writeBinaryFile?: (options: { path: string; content: Uint8Array }) => Promise<void>; readBinaryFile?: (options: { path: string }) => Promise<Uint8Array | null> }

type AnyTool = { execute?: (...args: never[]) => unknown }
type ToolInput<T> = T extends { execute?: (input: infer I, ...rest: never[]) => unknown } ? I : never
type ToolOutput<T> = T extends { execute?: (...args: never[]) => infer R } ? Exclude<Awaited<R>, AsyncIterable<unknown>> : never

export async function run<T extends AnyTool>(tool: T, input: ToolInput<T>, context: never) {
  const execute = tool.execute as ((input: ToolInput<T>, context: never) => unknown) | undefined
  if (!execute) throw new Error("This tool has no execute.")

  const result = await execute(input, context)
  return result as ToolOutput<T>
}

export async function createTestPersona(label: string) {
  const id = `${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const caller: Caller = { orgId: `org_test_${id}`, userId: `user_test_${id}` }

  // A test organization gets its Autumn customer on its first turn, on Free. The 25 credits are plenty for a test, and the customer goes away with the organization
  await db.orm.public.Organization.create({ orgId: caller.orgId, name: `Test ${label}`, members: [], invitations: [] })
  await db.orm.public.User.create({ authId: caller.userId, organizationIds: [caller.orgId], email: `${id}@test.dev` })
  const setup = await createProject(caller, { name: `Test ${label}` })
  if (!setup.ok) throw new Error(setup.error.message)
  const { project, persona } = setup.value

  const cleanup = async () => {
    const removed = await removeProject(caller, project.id)
    if (!removed.ok) throw new Error(removed.error.message)
    await db.orm.public.User.where({ authId: caller.userId }).deleteAll()
    await db.orm.public.Organization.where({ orgId: caller.orgId }).deleteAll()
    await new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY }).customers.delete({ customerId: caller.orgId, deleteInStripe: true }).catch(() => undefined)
  }

  const created = { caller, personaId: persona.id, cleanup }
  return created
}

export function toolContext(caller: Caller, personaId: string, sandbox: TestSandbox = {}) {
  const attributes = { orgId: caller.orgId, userId: caller.userId, personaId }
  const context = { session: { auth: { initiator: { attributes } } }, getSandbox: async () => sandbox }
  return context as never
}

// The channels match a settled call to a chat tool with eve's toolResultFrom, which looks the tool up among the tools eve loaded with the agent. The tests load no agent, so the chat tools go into eve's list here, under their names
const loaded = ((globalThis as Record<symbol, unknown>)[Symbol.for("eve.resolved-definition-sources")] ??= new WeakMap()) as WeakMap<object, { kind: "tool"; names: Set<string> }>
loaded.set(chatSay, { kind: "tool", names: new Set(["chat_say"]) })
loaded.set(chatFile, { kind: "tool", names: new Set(["chat_file"]) })
loaded.set(chatReact, { kind: "tool", names: new Set(["chat_react"]) })

// A tool call as eve 0.84 reports it once it has run: the call.settled fact, and the session view a channel reads the call's tool from
export function settledCall(name: string, output: unknown, outcome: "completed" | "failed" = "completed") {
  const callId = crypto.randomUUID()
  const at = new Date().toISOString()
  const scope = { turnId: "turn_test", runId: "run_test" }
  const requested = { type: "call.requested", data: { callId, owner: { runId: "run_test" }, capability: { kind: "tool", name } }, scope, meta: { position: { line: 1, index: 0 }, at, endOfLine: true } }
  const event = { type: "call.settled", data: { callId, outcome, output }, scope, meta: { position: { line: 2, index: 0 }, at, endOfLine: true } }
  const view = foldEvents(emptySessionView(), [requested, event] as never)
  return { event, view }
}
