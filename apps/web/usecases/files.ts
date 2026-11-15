import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { s3Files } from "@/lib/s3"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const MAX_BYTES = 2_147_483_647
const FILES_PREVIEW_URL = process.env.FILES_PREVIEW_URL!
const name = z.string().trim().min(1, "Give the file a name.").max(255, "Keep the file name under 255 characters.")
const contentType = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/, "That file type is not valid.")
const uploadInput = z.object({ name, contentType })
const completeInput = z.object({ fileId: z.uuid("This upload is not valid."), name })
const updateInput = z.object({ name: name.optional(), public: z.boolean().optional() })
const replaceInput = z.object({ contentType })
const saveInput = z.object({ name, contentType, bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array, "Give the file's bytes.") })

export async function listFiles(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const personaFiles = await db.orm.public.File.where({ personaId }).orderBy((file) => file.createdAt.desc()).all()
  return ok(personaFiles)
}

export async function getFileUpload(caller: Caller, personaId: string, input: z.input<typeof uploadInput>) {
  const parsed = validate(uploadInput, input)
  if (!parsed.ok) return parsed
  const { contentType } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const fileId = crypto.randomUUID()
  const uploadUrl = await s3Files.uploadUrl(fileKey(personaId, fileId), contentType)
  return ok({ fileId, uploadUrl })
}

export async function completeFileUpload(caller: Caller, personaId: string, input: z.input<typeof completeInput>) {
  const parsed = validate(completeInput, input)
  if (!parsed.ok) return parsed
  const { fileId, name } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const existing = await db.orm.public.File.where({ id: fileId }).first()
  if (existing) return err("conflict", "This file is already saved.")

  const stored = await checkUploaded(fileKey(personaId, fileId))
  if (!stored.ok) return stored

  const file = await db.orm.public.File.create({ id: fileId, personaId, name, contentType: stored.value.contentType, size: stored.value.size })
  return ok(file)
}

export async function saveFile(caller: Caller, personaId: string, input: z.input<typeof saveInput>) {
  const parsed = validate(saveInput, input)
  if (!parsed.ok) return parsed
  const { name, contentType, bytes } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona
  if (bytes.byteLength > MAX_BYTES) return err("invalid", "Files can be up to 2 GB.")

  const fileId = crypto.randomUUID()
  await s3Files.put(fileKey(personaId, fileId), bytes, contentType)
  const file = await db.orm.public.File.create({ id: fileId, personaId, name, contentType, size: bytes.byteLength })
  return ok(file)
}

export async function getFile(caller: Caller, fileId: string) {
  const file = await db.orm.public.File.where({ id: fileId }).first()
  if (!file) return err("not_found", "This file does not exist.")

  const persona = await getPersona(caller, file.personaId)
  if (!persona.ok) return err("not_found", "This file does not exist.")

  return ok(file)
}

export async function getFileView(fileId: string, caller: Caller | null = null) {
  const file = await db.orm.public.File.include("persona").where({ id: fileId }).first()
  if (!file) return err("not_found", "This file does not exist.")

  // A public file is open to anyone; a private one only to the members of its org
  const member = caller !== null && caller.orgId === file.persona.orgId
  if (!file.public && !member) return err("not_found", "This file does not exist.")

  const url = await s3Files.viewUrl(fileKey(file.personaId, file.id))
  const result = { id: file.id, name: file.name, contentType: file.contentType, size: file.size, public: file.public, createdAt: file.createdAt, url, persona: { name: file.persona.name, imageUrl: file.persona.imageUrl } }
  return ok(result)
}

// What the preview page shows: a published file of this persona, and nothing about a private one
export async function getPublishedFile(personaId: string, fileId: string) {
  if (!z.uuid().safeParse(fileId).success) return err("not_found", "This file does not exist.")

  const file = await db.orm.public.File.include("persona").where({ id: fileId, personaId, public: true }).first()
  if (!file) return err("not_found", "This file does not exist.")

  return ok({ ...file, url: s3Files.url(fileKey(personaId, fileId)) })
}

export async function readPublishedText(personaId: string, fileId: string) {
  const file = await getPublishedFile(personaId, fileId)
  if (!file.ok) return file

  const bytes = await s3Files.get(fileKey(personaId, fileId))
  return ok(new TextDecoder().decode(bytes))
}

// Two addresses, fixed from the start, both open only while the file is public: preview is the page that shows it, the one to send people; url is the file itself on the persona's own host, for inside a page
export async function getFileLinks(caller: Caller, fileId: string) {
  const file = await getFile(caller, fileId)
  if (!file.ok) return file

  const preview = `${FILES_PREVIEW_URL}/${file.value.personaId}/${file.value.id}`
  const url = s3Files.url(fileKey(file.value.personaId, file.value.id))
  return ok({ preview, url })
}


// A signed link to the file for the next 30 minutes: for eve, a channel's send and the tools
export async function getFileSignedUrl(caller: Caller, fileId: string) {
  const file = await getFile(caller, fileId)
  if (!file.ok) return file

  const signedUrl = await s3Files.viewUrl(fileKey(file.value.personaId, file.value.id))
  return ok(signedUrl)
}

export async function readFile(caller: Caller, fileId: string) {
  const file = await getFile(caller, fileId)
  if (!file.ok) return file

  const bytes = await s3Files.get(fileKey(file.value.personaId, file.value.id))
  const content = { name: file.value.name, contentType: file.value.contentType, size: file.value.size, bytes }
  return ok(content)
}

// The object follows the row: its metadata is what the files Worker reads before it serves the file
export async function updateFile(caller: Caller, fileId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const changes = withoutUndefined(parsed.value)

  const file = await getFile(caller, fileId)
  if (!file.ok) return file

  const next = { ...file.value, ...changes }
  const key = fileKey(next.personaId, next.id)
  await s3Files.update(key, { public: next.public ? "true" : "false", name: encodeURIComponent(next.name) })

  const updated = await db.orm.public.File.where({ id: fileId }).update(changes)
  if (!updated) return err("not_found", "This file does not exist.")

  return ok(updated)
}

export async function getFileReplaceUpload(caller: Caller, fileId: string, input: z.input<typeof replaceInput>) {
  const parsed = validate(replaceInput, input)
  if (!parsed.ok) return parsed
  const { contentType } = parsed.value

  const file = await getFile(caller, fileId)
  if (!file.ok) return file

  const uploadUrl = await s3Files.uploadUrl(fileKey(file.value.personaId, file.value.id), contentType)
  return ok({ uploadUrl })
}

export async function completeFileReplace(caller: Caller, fileId: string) {
  const file = await getFile(caller, fileId)
  if (!file.ok) return file

  const key = fileKey(file.value.personaId, file.value.id)
  const stored = await checkUploaded(key)
  if (!stored.ok) return stored

  // Update the new file metadata to what is was (replacing in r2 loses the old metadata)
  const isPublic = file.value.public ? "true" : "false"
  const encodedName = encodeURIComponent(file.value.name)
  await s3Files.update(key, { public: isPublic, name: encodedName })

  const updated = await db.orm.public.File.where({ id: fileId }).update({ contentType: stored.value.contentType, size: stored.value.size })
  if (!updated) return err("not_found", "This file does not exist.")

  return ok(updated)
}

export async function removeFile(caller: Caller, fileId: string) {
  const file = await getFile(caller, fileId)
  if (!file.ok) return file

  await s3Files.remove([fileKey(file.value.personaId, file.value.id)])
  await db.orm.public.File.where({ id: fileId }).delete()
  return ok(undefined)
}

async function checkUploaded(key: string) {
  const stored = await s3Files.head(key)
  if (!stored) return err("invalid", "Upload the file first.")

  if (stored.size > MAX_BYTES) {
    await s3Files.remove([key])
    return err("invalid", "Files can be up to 2 GB.")
  }

  return ok(stored)
}

function fileKey(personaId: string, fileId: string): string {
  const key = `${personaId}/${fileId}`
  return key
}
