import { z } from "zod"

import { connectAccount, deleteAccount, listAccounts, listToolkits, openSession } from "@/lib/composio"
import { err, ok, validate } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const toolkit = z.string().trim().min(1, "Pick an app.").max(100).regex(/^[a-z0-9_-]+$/i, "Pick an app from the list.")
const connectInput = z.object({ toolkit, callbackUrl: z.url({ protocol: /^https?$/ }).optional() })
const accountId = z.string().trim().min(1, "Pick an account.").max(100).regex(/^[a-z0-9_-]+$/i, "Pick an account from the list.")

export async function listApps() {
  const toolkits = await listToolkits()

  const apps = toolkits.map((item) => ({ toolkit: item.slug, name: item.name, description: item.meta.description ?? "", logo: item.meta.logo ?? null, categories: (item.meta.categories ?? []).map((category) => category.slug) }))
  return ok(apps)
}

export async function listConnectedApps(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const accounts = await listAccounts(personaId)
  return ok(accounts)
}

export async function connectApp(caller: Caller, personaId: string, input: z.input<typeof connectInput>) {
  const parsed = validate(connectInput, input)
  if (!parsed.ok) return parsed
  const { toolkit, callbackUrl } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const url = await connectAccount(personaId, toolkit, callbackUrl)
  return ok({ url })
}

export async function disconnectApp(caller: Caller, personaId: string, account: string) {
  const id = validate(accountId, account)
  if (!id.ok) return id

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const deleted = await deleteAccount(personaId, id.value)
  if (!deleted) return err("not_found", "This account is not connected.")

  return ok(undefined)
}

export async function openAppsSession(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const accounts = await listAccounts(personaId)
  const names = [...new Set(accounts.map((account) => account.name))]
  const session = await openSession(personaId, persona.value.composioSessionId)
  if (session.sessionId !== persona.value.composioSessionId) await db.orm.public.Persona.where({ id: personaId }).update({ composioSessionId: session.sessionId })

  const appsSession = { ...session, names }
  return ok(appsSession)
}
