import { and, or } from "@prisma/orm-postgres/orm-client"
import { z } from "zod"

import { err, ok, validate, withoutUndefined } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

const title = z.string().trim().min(1, "Give the note a title.").max(200, "Keep the title under 200 characters.")
const content = z.string().max(100_000, "Keep the note under 100,000 characters.")
const addInput = z.object({ title, content })
const updateInput = z.object({ title: title.optional(), content: content.optional() })
const searchInput = z.object({ query: z.string().trim().max(200, "Keep the search under 200 characters.").optional(), limit: z.number().int().min(1).max(50).optional() })

/** The persona's notes, newest first. A query keeps the notes that have each of its words in the title or the text, ignoring case; no query lists the latest. */
export async function searchNotes(caller: Caller, personaId: string, input: z.input<typeof searchInput> = {}) {
  const parsed = validate(searchInput, input)
  if (!parsed.ok) return parsed
  const { query, limit } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  if (!query) {
    const latest = await db.orm.public.Note.where({ personaId }).orderBy((note) => note.updatedAt.desc()).limit(limit ?? 20).all()
    return ok(latest)
  }

  const words = query.split(/\s+/)
  const found = await db.orm.public.Note.where({ personaId }).where((note) => and(...words.map((word) => or(note.title.ilike(`%${word}%`), note.content.ilike(`%${word}%`))))).orderBy((note) => note.updatedAt.desc()).limit(limit ?? 20).all()
  return ok(found)
}

export async function getNote(caller: Caller, noteId: string) {
  const note = await db.orm.public.Note.where({ id: noteId }).first()
  if (!note) return err("not_found", "This note does not exist.")

  const persona = await getPersona(caller, note.personaId)
  if (!persona.ok) return err("not_found", "This note does not exist.")

  return ok(note)
}

export async function addNote(caller: Caller, personaId: string, input: z.input<typeof addInput>) {
  const parsed = validate(addInput, input)
  if (!parsed.ok) return parsed
  const { title, content } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const note = await db.orm.public.Note.create({ personaId, title, content })
  return ok(note)
}

export async function updateNote(caller: Caller, noteId: string, input: z.input<typeof updateInput>) {
  const parsed = validate(updateInput, input)
  if (!parsed.ok) return parsed
  const changes = withoutUndefined(parsed.value)

  const note = await getNote(caller, noteId)
  if (!note.ok) return note
  if (Object.keys(changes).length === 0) return note

  const updated = await db.orm.public.Note.where({ id: noteId }).update(changes)
  if (!updated) return err("not_found", "This note does not exist.")

  return ok(updated)
}

export async function removeNote(caller: Caller, noteId: string) {
  const note = await getNote(caller, noteId)
  if (!note.ok) return note

  await db.orm.public.Note.where({ id: noteId }).delete()
  return ok(undefined)
}
