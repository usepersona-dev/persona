import { randomBytes } from "node:crypto"

import { z } from "zod"

import { err, ok, validate } from "@/lib/errors"
import { LINK_CODE_HOURS } from "@/lib/link-codes"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"
import { sharedTelegramBot } from "@/usecases/telegram"
import { getKapsoSharedNumber, getMetaSharedNumber } from "@/usecases/whatsapp-meta"

type Channel = "whatsapp" | "whatsapp_meta" | "telegram"

const channel = z.enum(["whatsapp", "whatsapp_meta", "telegram"])
const address = z.object({ channel, line: z.string().min(1), externalId: z.string().min(1) })
const updateInput = z.object({ reports: z.boolean() })
const redeemInput = address.extend({ code: z.string().trim().toLowerCase(), label: z.string().trim().max(120).optional(), phone: z.string().trim().max(32).nullish() })

export async function createLinkCode(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const code = randomBytes(4).toString("hex")
  const expiresAt = new Date(Date.now() + LINK_CODE_HOURS * 60 * 60 * 1000).toISOString()
  const linkCode = await db.orm.public.LinkCode.create({ code, personaId, expiresAt })
  return ok(linkCode)
}

export async function listLinkCodes(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const now = new Date().toISOString()
  const linkCodes = await db.orm.public.LinkCode.where({ personaId }).where((linkCode) => linkCode.expiresAt.gt(now)).orderBy((linkCode) => linkCode.createdAt.desc()).all()
  return ok(linkCodes)
}

export async function removeLinkCode(caller: Caller, code: string) {
  const linkCode = await db.orm.public.LinkCode.where({ code }).first()
  if (!linkCode) return err("not_found", "This code does not exist.")

  const persona = await getPersona(caller, linkCode.personaId)
  if (!persona.ok) return err("not_found", "This code does not exist.")

  await db.orm.public.LinkCode.where({ code }).delete()
  return ok(undefined)
}

export async function redeemLinkCode(input: z.input<typeof redeemInput>) {
  const parsed = validate(redeemInput, input)
  if (!parsed.ok) return parsed
  const { channel, line, externalId, code, label, phone } = parsed.value

  const linkCode = await db.orm.public.LinkCode.where({ code }).first()
  if (!linkCode) return err("not_found", "This code does not exist or has expired.")
  if (Date.parse(linkCode.expiresAt) <= Date.now()) return err("not_found", "This code does not exist or has expired.")

  const persona = await db.orm.public.Persona.where({ id: linkCode.personaId }).first()
  if (!persona) return err("not_found", "This code does not exist or has expired.")

  const allowed = await lineServesProject(channel, line, persona.projectId)
  if (!allowed) return err("not_found", "This code does not work on this number.")

  const existing = await db.orm.public.Link.where({ channel, line, externalId }).first()
  if (existing) await db.orm.public.Link.where({ channel, line, externalId }).update({ personaId: persona.id, label: label ?? existing.label, phone: phone ?? existing.phone })
  else await db.orm.public.Link.create({ channel, line, externalId, personaId: persona.id, label: label ?? null, phone: phone ?? null })

  await db.orm.public.LinkCode.where({ code }).delete()
  return ok({ personaId: persona.id, personaName: persona.name })
}

export async function findLinkedPersona(input: z.input<typeof address>) {
  const parsed = validate(address, input)
  if (!parsed.ok) return parsed
  const { channel, line, externalId } = parsed.value

  const link = await db.orm.public.Link.include("persona").where({ channel, line, externalId }).first()
  if (!link) return ok(null)

  await db.orm.public.Link.where({ id: link.id }).update({ lastMessageAt: new Date().toISOString() })
  return ok(link)
}

export async function listLinks(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const links = await db.orm.public.Link.where({ personaId }).orderBy((link) => link.createdAt.desc()).all()
  return ok(links)
}

export async function updateLink(caller: Caller, ref: z.input<typeof address>, input: z.input<typeof updateInput>) {
  const parsed = validate(address, ref)
  if (!parsed.ok) return parsed
  const { channel, line, externalId } = parsed.value

  const changes = validate(updateInput, input)
  if (!changes.ok) return changes

  const link = await db.orm.public.Link.where({ channel, line, externalId }).first()
  if (!link) return err("not_found", "This person is not linked.")

  const persona = await getPersona(caller, link.personaId)
  if (!persona.ok) return err("not_found", "This person is not linked.")

  const updated = await db.orm.public.Link.where({ id: link.id }).update(changes.value)
  if (!updated) return err("not_found", "This person is not linked.")

  return ok(updated)
}

export async function unlink(caller: Caller, input: z.input<typeof address>) {
  const parsed = validate(address, input)
  if (!parsed.ok) return parsed
  const { channel, line, externalId } = parsed.value

  const link = await db.orm.public.Link.where({ channel, line, externalId }).first()
  if (!link) return err("not_found", "This person is not linked.")

  const persona = await getPersona(caller, link.personaId)
  if (!persona.ok) return err("not_found", "This person is not linked.")

  await db.orm.public.Link.where({ channel, line, externalId }).delete()
  return ok(undefined)
}

async function lineServesProject(channel: Channel, line: string, projectId: string): Promise<boolean> {
  if (channel === "whatsapp") {
    const shared = getKapsoSharedNumber()
    if (shared.phoneNumberId === line) return true
    return false
  }

  if (channel === "whatsapp_meta") {
    const shared = getMetaSharedNumber()
    if (shared && shared.phoneNumberId === line) return true
    const metaLine = await db.orm.public.MetaLine.where({ phoneNumberId: line, projectId }).first()
    return metaLine !== null
  }

  if (channel === "telegram") {
    const sharedBot = sharedTelegramBot()
    if (sharedBot && sharedBot.botId === line) return true
    const ownBot = await db.orm.public.TelegramBot.where({ botId: line, projectId }).first()
    return ownBot !== null
  }

  throw new Error(`Unknown channel: ${channel}`)
}
