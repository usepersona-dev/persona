const API = "https://api.telegram.org"

export type BotProfile = { id: number; username: string; name: string }

export async function getMe(token: string): Promise<BotProfile> {
  const me = await call<{ id: number; username?: string; first_name: string }>(token, "getMe")
  if (!me.username) throw new Error("This bot has no username yet. Give it one in BotFather first.")
  return { id: me.id, username: me.username, name: me.first_name }
}

export async function setWebhook(token: string, url: string, secret: string): Promise<void> {
  await call(token, "setWebhook", { url, secret_token: secret, allowed_updates: ["message"] })
}

export async function deleteWebhook(token: string): Promise<void> {
  await call(token, "deleteWebhook", { drop_pending_updates: true })
}

async function call<T = true>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API}/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
  const answered: { ok: boolean; result?: T; description?: string } = await response.json()
  if (!response.ok || !answered.ok || answered.result === undefined) throw new Error(`Telegram answered ${response.status} to ${method}${answered.description ? `: ${answered.description}` : "."}`)
  return answered.result
}
