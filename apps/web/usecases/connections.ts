import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { mcp } from "@/lib/mcp"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"
import { mergeSecret, mergeValues, readSecret, readSecrets, removeSecrets, type SecretValue } from "@/usecases/secrets"

const RESERVED_NAMES = ["apps", "eve", "memory"]

const name = z.string().trim().min(1, "Give the connection a name.").max(64, "Keep the name under 64 characters.").regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, numbers and dashes, starting with a letter.").refine((value) => !RESERVED_NAMES.includes(value), "Persona uses this name. Pick another.")
const url = z.url({ protocol: /^https?$/, error: "Use an http or https address." })
const description = z.string().trim().max(1000, "Keep the description under 1000 characters.")
const headerName = z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+$/, "Header names use letters, numbers and dashes.")
const headerValue = z.string().min(1, "Give every header a value.").max(4000, "Keep header values under 4000 characters.")
const addInput = z.object({ name, url, description: description.optional(), headers: z.record(headerName, headerValue).optional(), enabled: z.boolean().optional() })
const updateInput = z.object({ name: name.optional(), url: url.optional(), description: description.optional(), enabled: z.boolean().optional(), headers: z.record(headerName, headerValue.nullable()).optional() })
const checkInput = z.union([z.object({ connectionId: z.string(), url: url.optional(), headers: z.record(headerName, headerValue.nullable()).optional() }), z.object({ url, headers: z.record(headerName, headerValue).optional() })])

export async function listConnections(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const connections = await db.orm.public.Connection.where({ personaId }).orderBy((connection) => connection.createdAt.asc()).all()
  const secrets = await readSecrets(connections.map((connection) => connection.id))

  const result = connections.map((connection) => withHeaderNames(connection, secrets.get(connection.id) ?? []))
  return ok(result)
}

export async function addConnection(caller: Caller, personaId: string, input: z.input<typeof addInput>) {
  const parsed = validate(addInput, input)
  if (!parsed.ok) return parsed
  const { name, url, description, headers, enabled } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const taken = await db.orm.public.Connection.where({ personaId, name }).first()
  if (taken) return err("conflict", `This persona already has a connection named "${name}".`)

  const connection = await db.orm.public.Connection.create({ personaId, name, url, description: description ?? "", enabled: enabled ?? true })
  let savedHeaders: readonly SecretValue[] = []
  if (headers) savedHeaders = await mergeSecret(connection.id, headers)

  const result = withHeaderNames(connection, savedHeaders)
  return ok(result)
}

export async function updateConnection(caller: Caller, connectionId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const { headers, ...fields } = parsed.value
  const changes = withoutUndefined(fields)

  const connection = await findConnection(caller, connectionId)
  if (!connection.ok) return connection

  if (changes.name && changes.name !== connection.value.name) {
    const taken = await db.orm.public.Connection.where({ personaId: connection.value.personaId, name: changes.name }).first()
    if (taken) return err("conflict", `This persona already has a connection named "${changes.name}".`)
  }

  let updated = connection.value
  if (Object.keys(changes).length > 0) {
    const row = await db.orm.public.Connection.where({ id: connectionId }).update(changes)
    if (!row) return err("not_found", "This connection does not exist.")
    updated = row
  }

  let savedHeaders: readonly SecretValue[]
  if (headers) savedHeaders = await mergeSecret(connectionId, headers)
  else savedHeaders = await readSecret(connectionId)

  const result = withHeaderNames(updated, savedHeaders)
  return ok(result)
}

export async function removeConnection(caller: Caller, connectionId: string) {
  const connection = await findConnection(caller, connectionId)
  if (!connection.ok) return connection

  await db.orm.public.Connection.where({ id: connectionId }).delete()
  await removeSecrets([connectionId])
  return ok(undefined)
}

// A saved connection is checked as an update would leave it: the url and headers given go over its own, merged the same way, so a change can be checked before it is saved
export async function checkConnection(caller: Caller, input: z.input<typeof checkInput>) {
  const parsed = validate(checkInput, input)
  if (!parsed.ok) return parsed
  const target = parsed.value

  if (!("connectionId" in target)) {
    const probe = await mcp.probe(target.url, target.headers ?? {})
    return ok(probe)
  }

  const connection = await findConnection(caller, target.connectionId)
  if (!connection.ok) return connection

  const storedHeaders = await readSecret(connection.value.id)
  const values = mergeValues(storedHeaders, target.headers ?? {})
  const headers = Object.fromEntries(values.map((header) => [header.name, header.value]))

  const probe = await mcp.probe(target.url ?? connection.value.url, headers)
  return ok(probe)
}

async function findConnection(caller: Caller, connectionId: string) {
  const connection = await db.orm.public.Connection.where({ id: connectionId }).first()
  if (!connection) return err("not_found", "This connection does not exist.")

  const persona = await getPersona(caller, connection.personaId)
  if (!persona.ok) return err("not_found", "This connection does not exist.")

  return ok(connection)
}

function withHeaderNames<Row>(connection: Row, headers: readonly SecretValue[]) {
  const headerNames = headers.map((header) => header.name)
  const result = { ...connection, headers: headerNames }
  return result
}
