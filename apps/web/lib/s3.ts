import { CopyObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, NotFound, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { z } from "zod"

import { withoutUndefined } from "@/lib/errors"

const objectMetadata = z.object({ public: z.enum(["true", "false"]).optional(), name: z.string().optional() })
export type ObjectMetadata = z.infer<typeof objectMetadata>
export type StoredObject = { size: number; contentType: string; metadata: ObjectMetadata }

const PUBLISHED_FILES_DOMAIN = process.env.PUBLISHED_FILES_DOMAIN!
const UPLOAD_SECONDS = 10 * 60
const VIEW_WINDOW_SECONDS = 15 * 60

// Any storage that speaks S3. S3_ENDPOINT is its address: https://<account>.r2.cloudflarestorage.com with the region "auto" on Cloudflare R2, https://s3.<region>.amazonaws.com on AWS S3, or a MinIO server's public address.
// The bucket goes in the path and not in the host (forcePathStyle): MinIO needs that, and R2 and AWS S3 take it too
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ""
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED"
})

class Bucket {
  readonly name: string

  constructor(name: string) {
    this.name = name
  }

  // The address the files Worker answers for a key, fixed from the start: the key's first segment is the host, the rest the path
  url(key: string): string {
    const [label, ...path] = key.split("/")
    return `https://${label}.${PUBLISHED_FILES_DOMAIN}/${path.join("/")}`
  }

  async uploadUrl(key: string, contentType: string): Promise<string> {
    return await getSignedUrl(s3, new PutObjectCommand({ Bucket: this.name, Key: key, ContentType: contentType }), { expiresIn: UPLOAD_SECONDS, signableHeaders: new Set(["content-type"]) })
  }

  // A link to view the file. It is signed from the start of the current 15-minute window and lasts 30 minutes, so every call in one window gives the same link and the browser can cache the file
  async viewUrl(key: string): Promise<string> {
    const signingDate = new Date(Math.floor(Date.now() / (VIEW_WINDOW_SECONDS * 1000)) * VIEW_WINDOW_SECONDS * 1000)
    return await getSignedUrl(s3, new GetObjectCommand({ Bucket: this.name, Key: key }), { expiresIn: 2 * VIEW_WINDOW_SECONDS, signingDate })
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await s3.send(new PutObjectCommand({ Bucket: this.name, Key: key, Body: bytes, ContentType: contentType }))
  }

  async get(key: string): Promise<Uint8Array> {
    const object = await s3.send(new GetObjectCommand({ Bucket: this.name, Key: key }))
    if (!object.Body) throw new Error(`The storage sent no body for ${key}.`)
    return await object.Body.transformToByteArray()
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const object = await s3.send(new HeadObjectCommand({ Bucket: this.name, Key: key }))
      return { size: object.ContentLength ?? 0, contentType: object.ContentType ?? "application/octet-stream", metadata: objectMetadata.parse(object.Metadata ?? {}) }
    } catch (error) {
      if (error instanceof NotFound) return null
      throw error
    }
  }

  // The new values go over what the object holds; a copy onto itself writes them and moves no bytes
  async update(key: string, changes: ObjectMetadata): Promise<void> {
    const object = await s3.send(new HeadObjectCommand({ Bucket: this.name, Key: key }))
    const metadata = { ...object.Metadata, ...withoutUndefined(changes) }
    await s3.send(new CopyObjectCommand({ Bucket: this.name, Key: key, CopySource: `${this.name}/${encodeKey(key)}`, MetadataDirective: "REPLACE", ContentType: object.ContentType, Metadata: metadata }))
  }

  async copy(from: string, to: string): Promise<void> {
    await s3.send(new CopyObjectCommand({ Bucket: this.name, Key: to, CopySource: `${this.name}/${encodeKey(from)}` }))
  }

  async remove(keys: string[]): Promise<void> {
    for (let start = 0; start < keys.length; start += 1000) {
      const result = await s3.send(new DeleteObjectsCommand({ Bucket: this.name, Delete: { Objects: keys.slice(start, start + 1000).map((key) => ({ Key: key })), Quiet: true } }))
      if (result.Errors?.length) throw new Error(`The storage could not delete ${result.Errors.length} files.`)
    }
  }

  async removeFolder(prefix: string): Promise<void> {
    if (!prefix) throw new Error("Refusing to empty the whole bucket.")
    for (; ;) {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: this.name, Prefix: prefix }))
      const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : []))
      if (keys.length === 0) return
      await this.remove(keys)
    }
  }
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/")
}

// One private bucket holds every file and picture. The app reads through signed links; the files Worker serves an object to everyone when its metadata marks it public, and the pictures under uploads/ always
export const s3Files = new Bucket(process.env.S3_FILES_BUCKET!)
