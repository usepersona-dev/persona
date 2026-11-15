import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import fileDelete from "@/agent/tools/file_delete"
import fileList from "@/agent/tools/file_list"
import fileGet from "@/agent/tools/file_get"
import filePublish from "@/agent/tools/file_publish"
import fileUnpublish from "@/agent/tools/file_unpublish"
import fileUpdate from "@/agent/tools/file_update"
import fileRead from "@/agent/tools/file_read"
import fileSave from "@/agent/tools/file_save"
import { s3Files } from "@/lib/s3"
import { db } from "@/prisma/db"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never
const sandbox = new Map<string, Uint8Array>([["/workspace/report.md", new TextEncoder().encode("# Weekly report\n\nAll good.")]])

beforeAll(async () => {
  persona = await createTestPersona("files-tools")
  context = toolContext(persona.caller, persona.personaId, { readBinaryFile: async ({ path }) => sandbox.get(path) ?? null, writeBinaryFile: async ({ path, content }) => void sandbox.set(path, content) })
})

afterAll(async () => {
  await persona.cleanup()
  await db.close()
})

test("files: save a sandbox file, list it, publish it, rename it, open it again, delete it", async () => {
  const saved = await run(fileSave, { path: "/workspace/report.md" }, context)
  assert.deepEqual({ name: saved.name, contentType: saved.contentType, size: saved.size }, { name: "report.md", contentType: "text/markdown", size: 26 })

  const listed = await run(fileList, {}, context)
  assert.deepEqual(listed.files.map((file) => ({ id: file.id, name: file.name })), [{ id: saved.id, name: "report.md" }])

  const key = `${persona.personaId}/${saved.id}`
  const preview = `${process.env.FILES_PREVIEW_URL}/${key}`
  const url = `https://${persona.personaId}.${process.env.PUBLISHED_FILES_DOMAIN}/${saved.id}`
  const closed = await run(fileGet, { fileId: saved.id }, context)
  assert.deepEqual(closed, { fileId: saved.id, public: false, preview, url })
  assert.equal((await fetch(url)).status, 404)

  const published = await run(filePublish, { fileIds: [saved.id] }, context)
  assert.deepEqual(published, { files: [{ fileId: saved.id, preview, url }] })
  assert.deepEqual(await run(fileGet, { fileId: saved.id }, context), { fileId: saved.id, public: true, preview, url })
  assert.deepEqual(await s3Files.head(key), { size: 26, contentType: "text/markdown", metadata: { public: "true", name: "report.md" } })
  const open = await fetch(url)
  assert.equal(await open.text(), "# Weekly report\n\nAll good.")
  assert.equal(new TextDecoder().decode(await s3Files.get(key)), "# Weekly report\n\nAll good.")

  const renamed = await run(fileUpdate, { fileId: saved.id, name: "report-week-1.md" }, context)
  assert.equal(renamed.name, "report-week-1.md")

  await run(fileUnpublish, { fileIds: [saved.id] }, context)
  assert.deepEqual(await run(fileGet, { fileId: saved.id }, context), { fileId: saved.id, public: false, preview, url })
  assert.equal((await s3Files.head(key))?.metadata.public, "false")
  await run(filePublish, { fileIds: [saved.id] }, context)

  const opened = await run(fileRead, { fileId: saved.id }, context)
  assert.equal(opened.path, "/workspace/files/report-week-1.md")
  assert.equal(new TextDecoder().decode(sandbox.get(opened.path)), "# Weekly report\n\nAll good.")

  await run(fileDelete, { fileId: saved.id }, context)
  const emptied = await run(fileList, {}, context)
  assert.equal(emptied.files.length, 0)
  assert.equal(await s3Files.head(key), null)
})

test("files: a missing sandbox file or an unknown file is refused", async () => {
  await assert.rejects(run(fileSave, { path: "/workspace/missing.md" }, context), /no file at/)
  await assert.rejects(run(fileRead, { fileId: "00000000-0000-0000-0000-000000000000" }, context), /does not exist/)
  await assert.rejects(run(fileGet, { fileId: "00000000-0000-0000-0000-000000000000" }, context), /does not exist/)
  await assert.rejects(run(fileDelete, { fileId: "00000000-0000-0000-0000-000000000000" }, context), /does not exist/)
})
