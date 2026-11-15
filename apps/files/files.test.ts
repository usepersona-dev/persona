import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"

import worker, { type Env } from "./files.ts"

// The files Worker's rules, with the storage faked: fetch answers for the bucket, as R2, AWS S3 or MinIO would
const env: Env = { S3_ENDPOINT: "https://storage.test", S3_REGION: "auto", S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret", S3_FILES_BUCKET: "files" }
const stored: Record<string, { type: string; public?: string; name?: string; body: string }> = {
  "persona1/page": { type: "text/html", public: "true", name: "My%20page.html", body: "<h1>hi</h1>" },
  "persona1/report": { type: "application/pdf", public: "true", name: "Report.pdf", body: "%PDF-1.7" },
  "persona1/archive": { type: "application/zip", public: "true", name: "All.zip", body: "PK" },
  "persona1/private": { type: "text/html", public: "false", name: "Secret.html", body: "secret" },
  "uploads/org1/picture": { type: "image/png", body: "png" },
}

let asked: { method: string; host: string; key: string; signed: boolean }[] = []

globalThis.fetch = async (input: RequestInfo | URL) => {
  const request = input as Request
  const url = new URL(request.url)
  const key = url.pathname.slice("/files/".length)
  const authorization = request.headers.get("authorization") || ""
  asked.push({ method: request.method, host: url.host, key, signed: authorization.startsWith("AWS4-HMAC-SHA256") })

  const object = stored[key]
  if (key === "persona1/broken") return new Response("<Error>AccessDenied</Error>", { status: 403 })
  if (!object) return new Response(null, { status: 404 })

  const headers: Record<string, string> = { "content-type": object.type, "content-length": String(object.body.length), etag: '"v1"' }
  if (object.public) headers["x-amz-meta-public"] = object.public
  if (object.name) headers["x-amz-meta-name"] = object.name
  if (request.method === "HEAD") return new Response(null, { headers })
  if (request.headers.get("if-none-match") === '"v1"') return new Response(null, { status: 304, headers: { etag: '"v1"' } })
  if (request.headers.get("range") === "bytes=0-1") return new Response(object.body.slice(0, 2), { status: 206, headers: { ...headers, "content-length": "2", "content-range": `bytes 0-1/${object.body.length}` } })
  return new Response(object.body, { headers })
}

beforeEach(() => {
  asked = []
})

function ask(host: string, path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(new Request(`https://${host}/${path}`, init), env)
}

test("a persona's file only on its own host and once published, a picture always", async () => {
  assert.equal((await ask("persona1.files.test", "page")).status, 200)
  assert.equal((await ask("persona2.files.test", "page")).status, 404)
  assert.equal((await ask("persona1.files.test", "private")).status, 404)
  assert.equal((await ask("persona1.files.test", "missing")).status, 404)
  assert.equal((await ask("uploads.files.test", "org1/picture")).status, 200)
})

test("the file comes from the bucket, through signed calls, with the rules every file gets", async () => {
  const page = await ask("persona1.files.test", "page")
  assert.equal(await page.text(), "<h1>hi</h1>")
  assert.equal(page.headers.get("content-type"), "text/html")
  assert.equal(page.headers.get("x-content-type-options"), "nosniff")
  assert.equal(page.headers.get("cache-control"), "public, max-age=60")
  assert.equal(page.headers.get("content-disposition"), null)
  assert.deepEqual(asked, [
    { method: "HEAD", host: "storage.test", key: "persona1/page", signed: true },
    { method: "GET", host: "storage.test", key: "persona1/page", signed: true },
  ])
})

test("a download, under the file's name: when asked for, or when a browser could not show the type", async () => {
  const page = await ask("persona1.files.test", "page?download")
  assert.equal(page.headers.get("content-disposition"), "attachment; filename*=UTF-8''My%20page.html")

  const archive = await ask("persona1.files.test", "archive")
  assert.equal(archive.headers.get("content-disposition"), "attachment; filename*=UTF-8''All.zip")

  const report = await ask("persona1.files.test", "report")
  assert.equal(report.headers.get("content-disposition"), null)

  const picture = await ask("uploads.files.test", "org1/picture?download")
  assert.equal(picture.headers.get("content-disposition"), null)
})

test("the storage answers ranges and cache checks, and HEAD sends no body", async () => {
  const part = await ask("persona1.files.test", "report", { headers: { range: "bytes=0-1" } })
  assert.equal(part.status, 206)
  assert.equal(part.headers.get("content-range"), "bytes 0-1/8")
  assert.equal(await part.text(), "%P")

  const current = await ask("persona1.files.test", "report", { headers: { "if-none-match": '"v1"' } })
  assert.equal(current.status, 304)

  const head = await ask("persona1.files.test", "report", { method: "HEAD" })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get("content-length"), "8")
  assert.equal(await head.text(), "")
})

test("only reading, and a storage that refuses is an error, not a missing file", async () => {
  assert.equal((await ask("persona1.files.test", "page", { method: "POST" })).status, 405)
  await assert.rejects(ask("persona1.files.test", "broken"), /The storage answered 403 for persona1\/broken/)
})
