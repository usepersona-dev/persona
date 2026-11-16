import { AwsClient } from "aws4fetch"

// The files Worker: the public door of the private files bucket. Cloudflare runs this file as the Worker persona-files (wrangler.jsonc), and Docker Compose runs it with Node (server.ts).
//   https://<personaId>.<PUBLISHED_FILES_DOMAIN>/<fileId>   the object <personaId>/<fileId>, when its metadata says public=true (the app sets it on publish)
//   https://uploads.<PUBLISHED_FILES_DOMAIN>/<path>          a picture, the object uploads/<path>, always
//   anything else                                            404
// Each persona has a host of its own, so a page of one persona cannot reach another's, and none of them runs on the app's domain.
// It reads the bucket through the S3 API with the app's own five S3_* settings, so any storage that speaks S3 works

// The five settings: the Worker's secrets on Cloudflare, the process's settings with Node
export type Env = {
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_FILES_BUCKET: string
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Only GET and HEAD.", { status: 405 })

    // The host's first label is the folder: a persona's id, or uploads
    const url = new URL(request.url)
    const folder = url.hostname.split(".")[0]
    const key = folder + url.pathname
    const address = new URL(`/${env.S3_FILES_BUCKET}/${key}`, env.S3_ENDPOINT)
    // Two retries: a short wait on a storage hiccup, never a minute
    const storage = new AwsClient({ accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, region: env.S3_REGION, service: "s3", retries: 2 })

    // The metadata first, whatever the browser asked for, so the public check always reads it
    const found = await storage.fetch(address, { method: "HEAD" })
    if (found.status === 404) return notFound()
    if (!found.ok) throw new Error(`The storage answered ${found.status} for ${key}.`)

    const picture = folder === "uploads"
    const published = found.headers.get("x-amz-meta-public") === "true"
    if (!picture && !published) return notFound()

    // Then the file. The storage answers the browser's range and cache headers itself: a part of a video, or 304 when the browser's copy is current
    const stored = await storage.fetch(address, { method: request.method, headers: browserHeaders(request) })
    if (stored.status === 404) return notFound()
    const headers = responseHeaders(stored)

    // A download when the visitor asks for one (?download), or when a browser could not show the type anyway. The name is URI-encoded, as the metadata keeps it
    const name = found.headers.get("x-amz-meta-name")
    const asked = url.searchParams.has("download")
    const shown = isShownByBrowsers(found.headers.get("content-type") || "")
    if (name && (asked || !shown)) headers.set("content-disposition", `attachment; filename*=UTF-8''${name}`)

    return new Response(stored.body, { status: stored.status, headers })
  },
}

export default worker

// The browser's own range and cache headers, which the storage answers itself
function browserHeaders(request: Request) {
  const headers = new Headers()
  for (const name of ["range", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

// The file's own headers from the storage, and the ones every file gets
function responseHeaders(stored: Response) {
  const headers = new Headers()
  for (const name of ["content-type", "content-length", "content-range", "etag", "last-modified"]) {
    const value = stored.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set("accept-ranges", "bytes")
  headers.set("cache-control", "public, max-age=60")
  headers.set("x-content-type-options", "nosniff")
  return headers
}

// The types a browser shows itself. Any other type it can only download
function isShownByBrowsers(contentType: string) {
  if (contentType.startsWith("text/")) return true
  if (contentType.startsWith("image/")) return true
  if (contentType.startsWith("video/")) return true
  if (contentType.startsWith("audio/")) return true
  if (contentType.startsWith("application/pdf")) return true
  return false
}

function notFound() {
  return new Response("This file does not exist.", { status: 404 })
}
