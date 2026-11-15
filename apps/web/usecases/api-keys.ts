import { createHash, randomBytes } from "node:crypto"

import { z } from "zod"

import { err, ok, validate } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"

const PREFIX = "persona_sk_"
const TOUCH_AFTER_MS = 60_000
const createInput = z.object({ name: z.string().trim().min(1, "Give the key a name.").max(80, "Keep the name under 80 characters.") })
const visible = ["id", "name", "keyPrefix", "userId", "lastUsedAt", "createdAt"] as const

export async function listApiKeys(caller: Caller) {
  const apiKeys = await db.orm.public.ApiKey.where({ orgId: caller.orgId }).select(...visible).orderBy((apiKey) => apiKey.createdAt.desc()).all()
  return ok(apiKeys)
}

export async function createApiKey(caller: Caller, input: z.input<typeof createInput>) {
  const parsed = validate(createInput, input)
  if (!parsed.ok) return parsed
  const { name } = parsed.value

  const key = `${PREFIX}${randomBytes(32).toString("base64url")}`
  const keyHash = hash(key)
  const keyPrefix = key.slice(0, PREFIX.length + 4)

  const apiKey = await db.orm.public.ApiKey.select(...visible).create({ orgId: caller.orgId, userId: caller.userId, name, keyHash, keyPrefix })
  return ok({ apiKey, key })
}

export async function revokeApiKey(caller: Caller, apiKeyId: string) {
  const apiKey = await db.orm.public.ApiKey.where({ id: apiKeyId, orgId: caller.orgId }).first()
  if (!apiKey) return err("not_found", "This API key does not exist.")

  await db.orm.public.ApiKey.where({ id: apiKeyId }).delete()
  return ok(undefined)
}

export async function authenticateApiKey(key: string): Promise<Caller | null> {
  if (!key.startsWith(PREFIX)) return null

  const keyHash = hash(key)
  const apiKey = await db.orm.public.ApiKey.where({ keyHash }).first()
  if (!apiKey) return null

  const lastUsed = apiKey.lastUsedAt ? Date.parse(apiKey.lastUsedAt) : 0
  if (Date.now() - lastUsed > TOUCH_AFTER_MS) await db.orm.public.ApiKey.where({ id: apiKey.id }).update({ lastUsedAt: new Date().toISOString() })

  const caller = { orgId: apiKey.orgId, userId: apiKey.userId }
  return caller
}

function hash(key: string): string {
  const digest = createHash("sha256").update(key).digest("hex")
  return digest
}
