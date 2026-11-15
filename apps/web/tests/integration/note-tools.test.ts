import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import noteCreate from "@/agent/tools/note_create"
import noteDelete from "@/agent/tools/note_delete"
import noteRead from "@/agent/tools/note_read"
import noteSearch from "@/agent/tools/note_search"
import noteUpdate from "@/agent/tools/note_update"
import { db } from "@/prisma/db"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never

beforeAll(async () => {
  persona = await createTestPersona("note-tools")
  context = toolContext(persona.caller, persona.personaId)
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

test("notes: write, list, search, read, update, delete", async () => {
  const groceries = await run(noteCreate, { title: "Groceries", content: "Milk, eggs and tahini." }, context)
  await run(noteCreate, { title: "Dentist", content: "Tuesday at 10." }, context)

  const latest = await run(noteSearch, {}, context)
  assert.deepEqual(latest.notes.map((note) => note.title), ["Dentist", "Groceries"])

  const found = await run(noteSearch, { query: "TAHINI milk" }, context)
  assert.deepEqual(found.notes.map((note) => note.title), ["Groceries"])

  await run(noteUpdate, { id: groceries.id, content: "Milk, eggs, tahini and bread." }, context)
  const read = await run(noteRead, { id: groceries.id }, context)
  assert.equal(read.content, "Milk, eggs, tahini and bread.")

  await run(noteDelete, { id: groceries.id }, context)
  const left = await run(noteSearch, {}, context)
  assert.deepEqual(left.notes.map((note) => note.title), ["Dentist"])
})

test("notes: an unknown note is refused", async () => {
  await assert.rejects(run(noteRead, { id: "unknown" }, context), /does not exist/)
  await assert.rejects(run(noteDelete, { id: "unknown" }, context), /does not exist/)
})
