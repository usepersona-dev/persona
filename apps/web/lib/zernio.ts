import Zernio, { ZernioApiError } from "@zernio/node"

import { err, ok } from "@/lib/errors"

function zernioClient() {
  return new Zernio({ apiKey: process.env.ZERNIO_API_KEY || "none" })
}

// A text in a conversation on one of our numbers, quoting one of the person's messages when replyTo is given (WhatsApp's own id of it). Zernio shows the first link's preview unless told not to
export async function sendText(accountId: string, conversationId: string, message: string, replyTo: string | null) {
  try {
    await zernioClient().messages.sendInboxMessage({ path: { conversationId }, body: { accountId, message, replyTo: replyTo ?? undefined }, throwOnError: true })
    return ok(undefined)
  } catch (error) {
    return refused(error)
  }
}

// One of our files by its public link, as a photo, video, audio or document. A document keeps its name, which WhatsApp otherwise shows as "Untitled"
export async function sendFile(accountId: string, conversationId: string, file: { url: string; name: string; kind: "image" | "video" | "audio" | "file" }) {
  try {
    await zernioClient().messages.sendInboxMessage({ path: { conversationId }, body: { accountId, attachmentUrl: file.url, attachmentType: file.kind, attachmentName: file.name }, throwOnError: true })
    return ok(undefined)
  } catch (error) {
    return refused(error)
  }
}

// A file the person sent. WhatsApp's files sit behind Zernio's API and need our key (401 without it); a link on any other host is fetched without the key, so the key only ever goes to Zernio
export async function download(url: string) {
  const host = new URL(url).hostname
  const headers: Record<string, string> = {}
  if (host === "zernio.com" || host.endsWith(".zernio.com")) headers.Authorization = `Bearer ${process.env.ZERNIO_API_KEY}`

  const response = await fetch(url, { headers })
  if (!response.ok) return err("invalid", `Zernio answered ${response.status} to a file download.`)

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream"
  const data = await response.arrayBuffer()
  return ok({ bytes: new Uint8Array(data), contentType })
}

// The SDK throws on every answer that is not ok. A refusal (a 4xx) comes back as invalid with Zernio's own words, which say what to fix; any other failure throws on
function refused(error: unknown) {
  if (!(error instanceof ZernioApiError) || error.statusCode >= 500) throw error
  return err("invalid", error.message)
}
