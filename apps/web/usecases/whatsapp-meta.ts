import { randomBytes, randomInt } from "node:crypto"

import { z } from "zod"

import { err, ok, validate } from "@/lib/errors"
import { checkToken, findNumber, registerNumber, setNumberWebhook, setWebhook, subscribeAccount, unsubscribeAccount } from "@/lib/meta"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getProject } from "@/usecases/projects"

// WhatsApp numbers straight on Meta: Persona's shared number, whose keys sit in env, and numbers in the customers' own Meta accounts. For their own, the customer gives the number's two IDs, their app's ID and secret, and their system user's token; connecting tests them all with Meta, gives the number its own webhook address, and keeps the keys on the line, which never sends them back.
// Every number answers at /eve/v1/meta/<its phone number id>, so a webhook and a message out find the keys the same way
const lineInput = z.object({
  phoneNumberId: z.string().trim().regex(/^\d+$/, "The phone number ID is on your app's WhatsApp > API Setup page."),
  wabaId: z.string().trim().regex(/^\d+$/, "The messaging account ID is next to the phone number ID, on the same page."),
  appId: z.string().trim().regex(/^\d+$/, "The App ID is the number at the top of your app's dashboard."),
  appSecret: z.string().trim().regex(/^[a-f0-9]{32}$/i, "The App Secret is the 32-character code under App settings > Basic."),
  accessToken: z.string().trim().min(20, "That does not look like a Meta access token. Copy the system user's token again."),
})

// A line as the app sees it: everything but its keys
const visible = ["id", "projectId", "phoneNumberId", "wabaId", "appId", "number", "name", "createdAt"] as const

export type MetaLineKeys = { accessToken: string; appSecret: string; verifyToken: string }

// Persona's shared number on Meta, open to every project. A link reaches it on whatsapp_meta, by its phone number id. Null where its env is not set
export function getMetaSharedNumber() {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  if (!phoneNumberId) return null

  const shared = { phoneNumberId, number: process.env.META_PHONE_NUMBER ?? "" }
  return shared
}

// Persona's legacy shared number on Kapso. The app no longer shows it, and its channel stays for the chats already on it. A link reaches it on whatsapp, by its phone number id
export function getKapsoSharedNumber() {
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID
  if (!phoneNumberId) throw new Error("KAPSO_PHONE_NUMBER_ID is not set.")

  const shared = { phoneNumberId }
  return shared
}

// Persona's legacy shared number on Zernio, kept the same way. A link reaches it on whatsapp_v2, by its account id
export function getZernioSharedNumber() {
  const accountId = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID
  if (!accountId) throw new Error("ZERNIO_WHATSAPP_ACCOUNT_ID is not set.")

  const shared = { accountId }
  return shared
}

// Whether a Zernio account is one of this deployment's numbers: the shared one, or a project's line. Every deployment shares one Zernio account, so each one's webhook gets every number's messages
export async function isWhatsappAccount(accountId: string) {
  const shared = getZernioSharedNumber()
  if (shared.accountId === accountId) return ok(true)

  const line = await db.orm.public.WhatsappLine.where({ accountId }).first()
  return ok(line !== null)
}

// The project's own numbers, and Persona's shared one
export async function listMetaLines(caller: Caller, projectId: string) {
  const project = await getProject(caller, projectId)
  if (!project.ok) return project

  const lines = await db.orm.public.MetaLine.where({ projectId }).select(...visible).orderBy((line) => line.createdAt.asc()).all()
  const shared = getMetaSharedNumber()
  return ok({ shared, lines })
}

export async function connectMetaLine(caller: Caller, projectId: string, input: z.input<typeof lineInput>) {
  const parsed = validate(lineInput, input)
  if (!parsed.ok) return parsed
  const { phoneNumberId, wabaId, appId, appSecret, accessToken } = parsed.value

  const project = await getProject(caller, projectId)
  if (!project.ok) return project

  const shared = getMetaSharedNumber()
  if (shared?.phoneNumberId === phoneNumberId) return err("conflict", "That is Persona's own number.")
  const existing = await db.orm.public.MetaLine.where({ phoneNumberId }).select("number").first()
  if (existing) return err("conflict", `${existing.number} is already connected.`)

  // The test: Meta takes the token as this app's, and the token reads the number in that account
  const checked = await checkToken(appId, appSecret, accessToken)
  if (!checked.ok) return checked

  const found = await findNumber(accessToken, wabaId, phoneNumberId)
  if (!found.ok) return found
  const number = found.value

  // Meta checks the webhook's address the moment it is set, so the line and its verify token are saved first; a step Meta refuses takes the line out again
  const verifyToken = randomBytes(24).toString("hex")
  const line = await db.orm.public.MetaLine.select(...visible).create({ projectId, phoneNumberId, wabaId, appId, number: number.number, name: number.name, accessToken, appSecret, verifyToken })

  // Meta turns the app's fields on only through the app's own webhook, so it is upserted on every connect; every number also gets its own address, so no number depends on where the app's one points
  const callbackUrl = new URL(`/eve/v1/meta/${phoneNumberId}`, process.env.APP_URL).href
  const webhook = await setWebhook(appId, appSecret, callbackUrl, verifyToken)
  if (!webhook.ok) return dropLine(line.id, webhook.error.message)

  const subscribed = await subscribeAccount(accessToken, wabaId)
  if (!subscribed.ok) return dropLine(line.id, subscribed.error.message)

  const numberWebhook = await setNumberWebhook(accessToken, phoneNumberId, callbackUrl, verifyToken)
  if (!numberWebhook.ok) return dropLine(line.id, numberWebhook.error.message)

  if (!number.onCloudApi) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0")
    const registered = await registerNumber(accessToken, number.id, pin)
    if (!registered.ok) return dropLine(line.id, registered.error.message)
    await db.orm.public.MetaLine.where({ id: line.id }).update({ pin })
  }

  return ok(line)
}

// The line stops hearing its account only when no other line of ours shares it, since Meta's subscription is per account
export async function removeMetaLine(caller: Caller, lineId: string) {
  const line = await findMetaLine(caller, lineId)
  if (!line.ok) return line
  const { id, phoneNumberId, wabaId, accessToken } = line.value

  const sharing = await db.orm.public.MetaLine.where({ wabaId }).select("id").all()
  if (sharing.length === 1) await unsubscribeAccount(accessToken, wabaId).catch(() => undefined)

  await db.orm.public.Link.where({ channel: "whatsapp_meta", line: phoneNumberId }).deleteAll()
  await db.orm.public.MetaLine.where({ id }).delete()
  return ok(undefined)
}

// The number's keys, for the channel: Persona's shared number keeps them in env, every other number on its line
export async function readMetaLine(phoneNumberId: string) {
  const shared = getMetaSharedNumber()
  if (shared?.phoneNumberId === phoneNumberId) return readSharedKeys()

  const keys = await db.orm.public.MetaLine.where({ phoneNumberId }).select("accessToken", "appSecret", "verifyToken").first()
  if (!keys) return err("not_found", "This WhatsApp number is not connected to Persona.")

  return ok(keys)
}

function readSharedKeys() {
  const accessToken = process.env.META_ACCESS_TOKEN
  const appSecret = process.env.META_APP_SECRET
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!accessToken || !appSecret || !verifyToken) return err("not_found", "Persona's WhatsApp number has no keys.")

  const keys: MetaLineKeys = { accessToken, appSecret, verifyToken }
  return ok(keys)
}

async function dropLine(lineId: string, message: string) {
  await db.orm.public.MetaLine.where({ id: lineId }).delete()
  return err("invalid", message)
}

async function findMetaLine(caller: Caller, lineId: string) {
  const line = await db.orm.public.MetaLine.where({ id: lineId }).first()
  if (!line) return err("not_found", "This WhatsApp number does not exist.")

  const project = await db.orm.public.Project.where({ id: line.projectId, orgId: caller.orgId }).first()
  if (!project) return err("not_found", "This WhatsApp number does not exist.")

  return ok(line)
}
