import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { db } from "@/prisma/db"

export type SecretValue = { name: string; value: string }

// Every value is sealed with AES-256-GCM under SECRETS_KEY and bound to its owner, so a value copied to another row does not open. The build loads this file, so a missing key fails the deploy
const KEY = readKey()
const SEALED = "enc:v1:"

export async function readSecret(ownerId: string): Promise<readonly SecretValue[]> {
  const secret = await db.orm.public.Secret.where({ ownerId }).first()
  if (!secret) return []

  const values = secret.values.map((value) => ({ name: value.name, value: open(ownerId, value.value) }))
  return values
}

export async function readSecrets(ownerIds: string[]): Promise<Map<string, readonly SecretValue[]>> {
  const result = new Map<string, readonly SecretValue[]>()
  if (ownerIds.length === 0) return result

  const secrets = await db.orm.public.Secret.where((secret) => secret.ownerId.in(ownerIds)).all()
  for (const secret of secrets) result.set(secret.ownerId, secret.values.map((value) => ({ name: value.name, value: open(secret.ownerId, value.value) })))
  return result
}

export async function writeSecret(ownerId: string, values: readonly SecretValue[]): Promise<readonly SecretValue[]> {
  if (values.length === 0) {
    await db.orm.public.Secret.where({ ownerId }).deleteAll()
    return values
  }

  const sealed = values.map((value) => ({ name: value.name, value: seal(ownerId, value.value) }))
  await db.orm.public.Secret.upsert({ create: { ownerId, values: sealed }, update: { values: sealed }, conflictOn: { ownerId } })
  return values
}

export async function mergeSecret(ownerId: string, changes: Record<string, string | null>): Promise<readonly SecretValue[]> {
  const current = await readSecret(ownerId)
  const values = mergeValues(current, changes)
  const saved = await writeSecret(ownerId, values)
  return saved
}

// A string sets a value, null removes it, and a name left out stays
export function mergeValues(current: readonly SecretValue[], changes: Record<string, string | null>): SecretValue[] {
  const merged = new Map(current.map((value) => [value.name, value.value]))

  for (const [name, value] of Object.entries(changes)) {
    if (value === null) merged.delete(name)
    else merged.set(name, value)
  }

  const values = [...merged].map(([name, value]) => ({ name, value }))
  return values
}

export async function removeSecrets(ownerIds: string[]) {
  if (ownerIds.length === 0) return

  await db.orm.public.Secret.where((secret) => secret.ownerId.in(ownerIds)).deleteAll()
}

// A sealed value: the prefix, then the IV, GCM's tag and the ciphertext in base64url
function seal(ownerId: string, value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", KEY, iv).setAAD(Buffer.from(ownerId))
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const sealed = SEALED + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url")
  return sealed
}

// A value saved before sealing reads as it is
function open(ownerId: string, stored: string) {
  if (!stored.startsWith(SEALED)) return stored

  const bytes = Buffer.from(stored.slice(SEALED.length), "base64url")
  const decipher = createDecipheriv("aes-256-gcm", KEY, bytes.subarray(0, 12)).setAAD(Buffer.from(ownerId)).setAuthTag(bytes.subarray(12, 28))
  const value = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")
  return value
}

function readKey() {
  const key = Buffer.from(process.env.SECRETS_KEY ?? "", "base64")
  if (key.length !== 32) throw new Error("SECRETS_KEY is not set: 32 random bytes in base64.")
  return key
}
