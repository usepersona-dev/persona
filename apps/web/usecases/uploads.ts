import { z } from "zod"

import { ok, validate } from "@/lib/errors"
import { s3Files } from "@/lib/s3"
import type { Caller } from "@/usecases/auth"

const uploadInput = z.object({ contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"], "Pick a PNG, JPG, WebP or GIF picture.") })

// The storage's keys stay on the server, so it signs a short-lived URL and the browser uploads the picture straight to the bucket, under uploads/, which the files Worker serves to everyone.
// The returned url is what records keep, such as a project's imageUrl.
export async function createUpload(caller: Caller, input: z.input<typeof uploadInput>) {
  const parsed = validate(uploadInput, input)
  if (!parsed.ok) return parsed

  const key = `uploads/${caller.orgId}/${crypto.randomUUID()}`
  const uploadUrl = await s3Files.uploadUrl(key, parsed.value.contentType)
  const result = { url: s3Files.url(key), uploadUrl }
  return ok(result)
}
