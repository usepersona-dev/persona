import type { ToolKitItem } from "@composio/core"
import { AuthSchemeTypes, Composio } from "@composio/core"

export type ConnectedAccount = { id: string; toolkit: string; name: string; description: string; logo: string | null; displayName: string | null }

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY })
const PAGE_SIZE = 1000

export async function listToolkits(): Promise<ToolKitItem[]> {
  const secondPage = Buffer.from(`2-${PAGE_SIZE}`).toString("base64")
  const [first, second] = await Promise.all([composio.toolkits.get({ limit: PAGE_SIZE }), composio.toolkits.get({ limit: PAGE_SIZE, cursor: secondPage })])

  const toolkits = [...first, ...second]
  return toolkits
}

export async function listAccounts(uid: string): Promise<ConnectedAccount[]> {
  const response = await composio.connectedAccounts.list({ userIds: [uid], statuses: ["ACTIVE"], limit: 100 })
  const accounts = response.items ?? []
  if (accounts.length === 0) return []

  const slugs = [...new Set(accounts.map((account) => account.toolkit.slug))]
  const toolkits = await composio.toolkits.getMany(slugs, { limit: slugs.length })
  const toolkitsBySlug = new Map(toolkits.map((toolkit) => [toolkit.slug, toolkit]))

  const result = accounts.map((account) => {
    const toolkit = toolkitsBySlug.get(account.toolkit.slug)
    const displayName = account.state?.val.displayName as string | undefined
    return { id: account.id, toolkit: account.toolkit.slug, name: toolkit?.name ?? account.toolkit.slug, description: toolkit?.meta.description ?? "", logo: toolkit?.meta.logo ?? null, displayName: displayName ?? null }
  })
  return result
}

export async function connectAccount(uid: string, toolkit: string, callbackUrl?: string): Promise<string | null> {
  const authConfigId = await ensureAuthConfig(toolkit)
  const request = await composio.connectedAccounts.link(uid, authConfigId, { allowMultiple: true, callbackUrl })

  const redirectUrl = request.redirectUrl ?? null
  return redirectUrl
}

export async function deleteAccount(uid: string, accountId: string): Promise<boolean> {
  const response = await composio.connectedAccounts.list({ userIds: [uid], limit: 100 })
  const accounts = response.items ?? []
  const account = accounts.find((item) => item.id === accountId)
  if (!account) return false

  await composio.connectedAccounts.delete(account.id)
  return true
}

export async function deleteAccounts(uid: string): Promise<number> {
  const response = await composio.connectedAccounts.list({ userIds: [uid], limit: 100 })
  const accounts = response.items ?? []

  for (const account of accounts) await composio.connectedAccounts.delete(account.id)
  return accounts.length
}

export async function openSession(userId: string, sessionId: string | null) {
  const session = sessionId ? await composio.sessions.use(sessionId, { mcp: true }) : await composio.sessions.create(userId, { manageConnections: true, mcp: true, multiAccount: { enable: true, requireExplicitSelection: true } })

  const opened = { sessionId: session.sessionId, url: session.mcp.url, headers: session.mcp.headers }
  return opened
}

export async function deleteSession(sessionId: string): Promise<void> {
  const session = await composio.sessions.use(sessionId)
  await session.delete()
}

export type TriggerType = { slug: string; name: string; description: string; toolkit: string; config: Record<string, unknown> }
export type TriggerEvent = { id: string; triggerId: string; userId: string; slug: string; data: Record<string, unknown> }

export async function listTriggerTypes(toolkit: string): Promise<TriggerType[]> {
  const response = await composio.triggers.listTypes({ toolkits: [toolkit], limit: 100 })
  const result = response.items.map((type) => ({ slug: type.slug, name: type.name, description: type.description, toolkit: type.toolkit.slug, config: type.config }))
  return result
}

export async function getTriggerType(slug: string): Promise<TriggerType | null> {
  const type = await composio.triggers.getType(slug).catch(() => null)
  if (!type) return null

  const result = { slug: type.slug, name: type.name, description: type.description, toolkit: type.toolkit.slug, config: type.config }
  return result
}

export async function registerTrigger(uid: string, accountId: string, slug: string, config: Record<string, unknown>): Promise<string> {
  const created = await composio.triggers.create(uid, slug, { connectedAccountId: accountId, triggerConfig: config })
  return created.triggerId
}

export async function deleteTrigger(triggerId: string): Promise<void> {
  await composio.triggers.delete(triggerId)
}

// Composio posts every event of the project to one address, signed with the project's webhook secret; without the secret no event is trusted.
// For trigger events the parsed id is the trigger's and userId is ours (the persona id); other events (such as an expired connection) carry neither.
// The event's own id is the signed webhook-id header, which stays the same when Composio sends the event again (Standard Webhooks)
export async function readTriggerEvent(request: Request): Promise<TriggerEvent | null> {
  const secret = process.env.COMPOSIO_WEBHOOK_SECRET
  if (!secret) throw new Error("COMPOSIO_WEBHOOK_SECRET is not set.")

  const parsed = await composio.triggers.parse(request, { verifySecret: secret }).catch(() => null)
  if (!parsed) return null

  const id = request.headers.get("webhook-id")!
  const result = { id, triggerId: parsed.payload.id, userId: parsed.payload.userId, slug: parsed.payload.triggerSlug, data: parsed.payload.payload ?? {} }
  return result
}

async function ensureAuthConfig(toolkit: string): Promise<string> {
  const existing = (await composio.authConfigs.list({ toolkit })).items[0]?.id
  if (existing) return existing

  const details = await composio.toolkits.get(toolkit)
  if (details.composioManagedAuthSchemes?.length) {
    const result = await composio.authConfigs.create(toolkit, { type: "use_composio_managed_auth", name: `${toolkit} auth`, })
    return result.id
  }

  const mode = (details.authConfigDetails?.[0]?.mode ?? "API_KEY").toUpperCase()
  if (mode.startsWith("OAUTH")) throw new Error(`${toolkit} needs its own OAuth app credentials (a client ID & secret) that aren’t set up. Add this app in your Composio dashboard, then reconnect.`)

  const scheme = Object.values(AuthSchemeTypes).find((known) => known === mode)
  if (!scheme) throw new Error(`${toolkit} uses an auth scheme (${mode}) this app cannot set up.`)

  const result = await composio.authConfigs.create(toolkit, { type: "use_custom_auth", authScheme: scheme, credentials: {}, name: `${toolkit} auth`, })
  return result.id
}
