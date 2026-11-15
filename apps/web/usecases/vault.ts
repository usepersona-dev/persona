import { randomBytes } from "node:crypto"

import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"
import { mergeSecret, readSecret, readSecrets, removeSecrets, type SecretValue, writeSecret } from "@/usecases/secrets"

const LINK_HOURS = 24
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/
const title = z.string().trim().min(1, "Give the credential a title.").max(120, "Keep the title under 120 characters.")
const description = z.string().trim().max(1000, "Keep the description under 1000 characters.")
const field = z.object({ name: z.string().trim().min(1, "Name every field.").max(64, "Keep field names under 64 characters."), secret: z.boolean() })
const fields = z.array(field).min(1, "Add at least one field.").max(30, "A credential can have up to 30 fields.").refine((list) => new Set(list.map((item) => item.name)).size === list.length, "Give every field a different name.")
const addInput = z.object({ title, description: description.optional(), fields })
const updateInput = z.object({ title: title.optional(), description: description.optional(), fields: fields.optional() })
const valuesInput = z.record(z.string(), z.string().max(4000, "Keep each value under 4000 characters.").nullable())
const collectedInput = z.record(z.string(), z.string().max(4000, "Keep each value under 4000 characters."))

type Credential = { id: string; fields: readonly { name: string; secret: boolean }[] }

export async function listCredentials(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const credentials = await db.orm.public.Credential.where({ personaId }).orderBy((credential) => credential.createdAt.asc()).all()
  const secrets = await readSecrets(credentials.map((credential) => credential.id))

  const result = credentials.map((credential) => ({ ...credential, filled: filledFields(credential, secrets.get(credential.id) ?? []) }))
  return ok(result)
}

export async function readVault(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const credentials = await db.orm.public.Credential.where({ personaId }).orderBy((credential) => credential.createdAt.asc()).all()
  const secrets = await readSecrets(credentials.map((credential) => credential.id))

  const vault = credentials.map((credential) => ({ id: credential.id, title: credential.title, values: secrets.get(credential.id) ?? [] }))
  return ok(vault)
}

/** The persona's filled vault fields that are named as environment variables, such as OPENAI_API_KEY, as they are. A field with any other name is not a variable and stays out. */
export async function readVaultVariables(caller: Caller, personaId: string) {
  const vault = await readVault(caller, personaId)
  if (!vault.ok) return vault

  const values = vault.value.flatMap((credential) => credential.values)
  const variables = values.filter((value) => ENV_NAME.test(value.name))
  return ok(variables)
}

export async function readVaultSecrets(caller: Caller, personaId: string, credentialIds: readonly string[]) {
  if (credentialIds.length === 0) return ok({ found: [], missing: [] })

  const vault = await readVault(caller, personaId)
  if (!vault.ok) return vault

  const found = vault.value.filter((credential) => credentialIds.includes(credential.id))
  const missing = credentialIds.filter((credentialId) => !found.some((credential) => credential.id === credentialId))
  return ok({ found, missing })
}

export async function addCredential(caller: Caller, personaId: string, input: z.input<typeof addInput>) {
  const parsed = validate(addInput, input)
  if (!parsed.ok) return parsed
  const { title, description, fields } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const credential = await db.orm.public.Credential.create({ personaId, title, description: description ?? "", fields })
  return ok({ ...credential, filled: [] })
}

export async function updateCredential(caller: Caller, credentialId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const changes = withoutUndefined(parsed.value)

  const credential = await findCredential(caller, credentialId)
  if (!credential.ok) return credential

  let updated = credential.value
  if (Object.keys(changes).length > 0) {
    const row = await db.orm.public.Credential.where({ id: credentialId }).update(changes)
    if (!row) return err("not_found", "This credential does not exist.")
    updated = row
  }

  const storedValues = await readSecret(credentialId)
  const keptValues = storedValues.filter((value) => updated.fields.some((item) => item.name === value.name))
  await writeSecret(credentialId, keptValues)

  return ok({ ...updated, filled: filledFields(updated, keptValues) })
}

export async function removeCredential(caller: Caller, credentialId: string) {
  const credential = await findCredential(caller, credentialId)
  if (!credential.ok) return credential

  await db.orm.public.Credential.where({ id: credentialId }).delete()
  await removeSecrets([credentialId])
  return ok(undefined)
}

export async function setCredentialValues(caller: Caller, credentialId: string, input: z.input<typeof valuesInput>) {
  const parsed = validate(valuesInput, input)
  if (!parsed.ok) return parsed
  const values = parsed.value

  const credential = await findCredential(caller, credentialId)
  if (!credential.ok) return credential

  const filled = await fill(credential.value, values)
  if (!filled.ok) return filled

  return ok({ filled: filled.value })
}

export async function createCollectLink(caller: Caller, credentialId: string) {
  const credential = await findCredential(caller, credentialId)
  if (!credential.ok) return credential

  const appUrl = process.env.APP_URL
  if (!appUrl) throw new Error("APP_URL is not set.")

  // A short random code, kept with its credential: 64 bits no one can guess in the link's day
  const code = randomBytes(8).toString("base64url")
  const expiresAt = new Date(Date.now() + LINK_HOURS * 60 * 60 * 1000).toISOString()
  await db.orm.public.CollectLink.create({ code, credentialId, expiresAt })

  const url = new URL(`/collect/${code}`, appUrl).href
  return ok({ token: code, url, expiresAt })
}

export async function openCollectLink(token: string) {
  const link = await findLink(token)
  if (!link.ok) return link

  const credential = await db.orm.public.Credential.include("persona").where({ id: link.value.credentialId }).first()
  if (!credential) return err("not_found", "This link does not exist.")

  const storedValues = await readSecret(credential.id)
  const filled = filledFields(credential, storedValues)
  const formFields = credential.fields.map((item) => ({ ...item, filled: filled.includes(item.name) }))
  const persona = { name: credential.persona.name, imageUrl: credential.persona.imageUrl }
  return ok({ title: credential.title, description: credential.description, fields: formFields, expiresAt: link.value.expiresAt, persona })
}

export async function submitCollectLink(token: string, input: z.input<typeof collectedInput>) {
  const link = await findLink(token)
  if (!link.ok) return link

  const parsed = validate(collectedInput, input)
  if (!parsed.ok) return parsed
  const values = parsed.value

  const credential = await db.orm.public.Credential.where({ id: link.value.credentialId }).first()
  if (!credential) return err("not_found", "This link does not exist.")

  const nonEmptyValues = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""))
  const filled = await fill(credential, nonEmptyValues)
  if (!filled.ok) return filled

  return ok({ filled: filled.value })
}

async function findCredential(caller: Caller, credentialId: string) {
  const credential = await db.orm.public.Credential.where({ id: credentialId }).first()
  if (!credential) return err("not_found", "This credential does not exist.")

  const persona = await getPersona(caller, credential.personaId)
  if (!persona.ok) return err("not_found", "This credential does not exist.")

  return ok(credential)
}

async function fill(credential: Credential, values: Record<string, string | null>) {
  const unknownField = Object.keys(values).find((key) => !credential.fields.some((item) => item.name === key))
  if (unknownField) return err("invalid", `This credential has no field named "${unknownField}".`)

  const storedValues = await mergeSecret(credential.id, values)
  const filled = filledFields(credential, storedValues)
  return ok(filled)
}

function filledFields(credential: Credential, values: readonly SecretValue[]): string[] {
  const filled = credential.fields.filter((item) => values.some((value) => value.name === item.name)).map((item) => item.name)
  return filled
}

async function findLink(code: string) {
  const link = await db.orm.public.CollectLink.where({ code }).first()
  if (!link) return err("not_found", "This link does not exist.")
  if (Date.parse(link.expiresAt) < Date.now()) return err("invalid", "This link has expired. Ask for a new one.")

  return ok(link)
}
