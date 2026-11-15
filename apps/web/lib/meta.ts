import { err, ok, type Result } from "@/lib/errors"

// Meta's Graph API for a WhatsApp number in a customer's own Meta account: their system user's token reaches their WhatsApp accounts, and their app's id and secret sign in as the app, which owns the webhook. The version matches the Chat SDK's WhatsApp adapter
const GRAPH = "https://graph.facebook.com/v25.0"

export type MetaNumber = { id: string; wabaId: string; number: string; name: string; onCloudApi: boolean }

type GraphFailure = { error?: { message?: string; error_user_msg?: string } }

// Meta's own check of the token, made as the app it must belong to
export async function checkToken(appId: string, appSecret: string, token: string) {
  const url = new URL(`${GRAPH}/debug_token`)
  url.searchParams.set("input_token", token)
  url.searchParams.set("access_token", `${appId}|${appSecret}`)
  const checked = await call<{ data: { is_valid: boolean; app_id?: string } }>(url, { method: "GET" })
  if (!checked.ok) return checked

  const data = checked.value.data
  if (!data.is_valid) return err("invalid", "Meta says this token is not valid. Generate the system user's token again.")
  if (data.app_id !== appId) return err("invalid", "This token belongs to a different app. Generate it for the app whose ID and secret you gave.")
  return ok(undefined)
}

// The number in its WhatsApp account, read with the token. Meta's phone number has no field naming its account, so the account is asked for too. A number already on the Cloud API was registered by its owner, with their own PIN
export async function findNumber(token: string, accountId: string, phoneNumberId: string) {
  const url = new URL(`${GRAPH}/${accountId}/phone_numbers`)
  url.searchParams.set("fields", "id,display_phone_number,verified_name,platform_type")
  const listed = await call<{ data: { id: string; display_phone_number: string; verified_name: string; platform_type?: string }[] }>(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } })
  if (!listed.ok) return listed

  const found = listed.value.data.find((one) => one.id === phoneNumberId)
  if (!found) return err("not_found", "That phone number ID is not in that account. Copy both IDs again from the app's WhatsApp > API Setup page.")

  const number: MetaNumber = { id: found.id, wabaId: accountId, number: found.display_phone_number, name: found.verified_name, onCloudApi: found.platform_type === "CLOUD_API" }
  return ok(number)
}

// Puts a verified number on the Cloud API. The PIN becomes the number's two-step verification PIN
export async function registerNumber(token: string, phoneNumberId: string, pin: string) {
  const registered = await call(new URL(`${GRAPH}/${phoneNumberId}/register`), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", pin }) })
  return registered
}

// The app's own WhatsApp webhook: its fields, and the address Meta falls back to for a number without its own. Meta checks the address right away, with the token
export async function setWebhook(appId: string, appSecret: string, callbackUrl: string, verifyToken: string) {
  const url = new URL(`${GRAPH}/${appId}/subscriptions`)
  url.searchParams.set("access_token", `${appId}|${appSecret}`)
  const body = new URLSearchParams({ object: "whatsapp_business_account", callback_url: callbackUrl, verify_token: verifyToken, fields: "messages", include_values: "true" })
  const set = await call(url, { method: "POST", body })
  return set
}

// One number's own webhook address, which Meta uses before its account's and the app's
export async function setNumberWebhook(token: string, phoneNumberId: string, callbackUrl: string, verifyToken: string) {
  const body = JSON.stringify({ webhook_configuration: { override_callback_uri: callbackUrl, verify_token: verifyToken } })
  const set = await call(new URL(`${GRAPH}/${phoneNumberId}`), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body })
  return set
}

// The token's app hears the account's messages from now on
export async function subscribeAccount(token: string, accountId: string) {
  const subscribed = await call(new URL(`${GRAPH}/${accountId}/subscribed_apps`), { method: "POST", headers: { Authorization: `Bearer ${token}` } })
  return subscribed
}

export async function unsubscribeAccount(token: string, accountId: string) {
  const unsubscribed = await call(new URL(`${GRAPH}/${accountId}/subscribed_apps`), { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
  return unsubscribed
}

// Meta's refusals come back with its own words; a failure on Meta's side throws
async function call<T = unknown>(url: URL, init: RequestInit): Promise<Result<T>> {
  const response = await fetch(url, init)
  const answered = (await response.json().catch(() => ({}))) as T & GraphFailure
  if (response.ok) return ok(answered)

  const said = answered.error?.error_user_msg ?? answered.error?.message ?? `Meta answered ${response.status}.`
  if (response.status >= 500) throw new Error(`Meta answered ${response.status}: ${said}`)
  return err("invalid", said)
}
