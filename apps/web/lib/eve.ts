import { Client } from "eve/client"

// eve's session controls are HTTP routes on our own deployment, guarded by our agent token; eve/server offers reads only
function client(token: string) {
  const baseUrl = process.env.APP_URL
  if (!baseUrl) throw new Error("APP_URL is not set.")

  const eve = new Client({ baseUrl, headers: { authorization: `Bearer ${token}` } })
  return eve
}

export async function clearSession(sessionId: string, token: string) {
  const result = await client(token).sessions.attach(sessionId).clear()
  return result
}

export async function resetSession(sessionId: string, token: string) {
  const result = await client(token).sessions.attach(sessionId).end()
  return result
}

export async function compactSession(sessionId: string, token: string) {
  const result = await client(token).sessions.attach(sessionId).compact()
  return result
}

export async function cancelTurn(sessionId: string, token: string) {
  const result = await client(token).sessions.attach(sessionId).cancel()
  return result
}
