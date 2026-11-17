import { Mp3Encoder } from "@breezystack/lamejs"
import { experimental_getVideoStatus, experimental_startVideo, generateSpeech, generateText, type JSONValue, type LanguageModelUsage, transcribe } from "ai"
import { z } from "zod"

import { err, ok, validate } from "@/lib/errors"
import type { Caller } from "@/usecases/auth"
import { chargeModelCall } from "@/usecases/credits"
import { getFileSignedUrl, saveFile } from "@/usecases/files"
import { getPersona } from "@/usecases/personas"

export type StartedVideo = { model: string; operation: JSONValue; name: string }

const IMAGE_MODEL = "google/gemini-nano-banana-2.1"
const VIDEO_MODEL = "google/veo-3.1-fast-generate-001"
// The clip veo makes by default is 8 seconds with sound, at the gateway's $0.15 a second. Its reply names no price
const VIDEO_USD = 1.2
const READ_MODEL = "google/gemini-3.8-flash"
const SPEECH_MODEL = "google/gemini-3.8-flash-tts"
// Microsoft's speech model runs on our own Azure key. On Hebrew voice notes it wrote fewer wrong words than Gemini's transcribe model, which runs only on Vercel's key, in a third of the time
const TRANSCRIBE_MODEL = "microsoft/mai-transcribe-2"
export const VOICES = ["Kore", "Zephyr", "Leda", "Puck", "Charon"] as const
const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000]

const DESCRIBE = "Describe this file as fully as you can for someone who cannot open it. Say what it is, what it shows or says, quote any writing in it, and note anything that would matter to someone acting on it. Stay with what is actually there."
const MEDIA_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json", html: "text/html", zip: "application/zip" }
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "aac", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "text/csv": "csv", "application/json": "json", "text/html": "html", "application/zip": "zip" }

const prompt = z.string().trim().min(1, "Describe what to make.").max(8000, "Keep the description under 8,000 characters.")
const url = z.url({ protocol: /^https?$/, error: "Use an http or https address." })
const imageInput = z.object({ prompt })
const editInput = z.object({ images: z.array(url).min(1, "Give at least one image.").max(10, "Edit up to 10 images at once."), prompt })
const videoInput = z.object({ prompt })
const speechInput = z.object({ text: z.string().trim().min(1, "Give the text to say.").max(4096, "Keep the text under 4,096 characters."), voice: z.enum(VOICES).optional() })
const describeInput = z.object({ url, question: z.string().trim().max(2000).optional() })
const GENERATION = z.object({ gateway: z.object({ generationId: z.string(), marketCost: z.coerce.number().optional(), gatewayCost: z.coerce.number().nullish(), routing: z.object({ finalProvider: z.string().nullish() }).optional() }) })

export async function createImage(caller: Caller, personaId: string, input: z.input<typeof imageInput>) {
  const parsed = validate(imageInput, input)
  if (!parsed.ok) return parsed
  const { prompt } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const created = await generateText({ model: IMAGE_MODEL, prompt })
  await chargeReply(personaId, IMAGE_MODEL, created.finalStep.providerMetadata, created.usage)
  const [image] = created.files
  if (!image) return err("invalid", created.text || "The model made no image. Describe it another way.")

  const file = await store(caller, personaId, prompt, image.uint8Array, image.mediaType)
  return file
}

export async function editImage(caller: Caller, personaId: string, input: z.input<typeof editInput>) {
  const parsed = validate(editInput, input)
  if (!parsed.ok) return parsed
  const { images, prompt } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const content = [...images.map((source) => ({ type: "file" as const, data: new URL(source), mediaType: "image" })), { type: "text" as const, text: prompt }]
  const edited = await generateText({ model: IMAGE_MODEL, messages: [{ role: "user", content }] })
  await chargeReply(personaId, IMAGE_MODEL, edited.finalStep.providerMetadata, edited.usage)
  const [image] = edited.files
  if (!image) return err("invalid", edited.text || "The model made no image. Describe the change another way.")

  const file = await store(caller, personaId, prompt, image.uint8Array, image.mediaType)
  return file
}

export async function startVideo(caller: Caller, personaId: string, input: z.input<typeof videoInput>) {
  const parsed = validate(videoInput, input)
  if (!parsed.ok) return parsed
  const { prompt } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const { operation } = await experimental_startVideo({ model: VIDEO_MODEL, prompt })
  const started: StartedVideo = { model: VIDEO_MODEL, operation, name: prompt }
  return ok(started)
}

export async function readVideo(caller: Caller, personaId: string, video: StartedVideo) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const status = await experimental_getVideoStatus(video.model, { operation: video.operation })
  if (status.status === "error") throw new Error(`The video could not be made: ${status.error}`)
  if (status.status === "pending") return ok(null)

  // A failed count is logged and the clip still arrives
  const { generationId } = GENERATION.parse(status.providerMetadata).gateway
  await chargeModelCall(personaId, { id: generationId, model: video.model, marketCost: VIDEO_USD }).catch((error) => console.warn("Video usage was not saved.", generationId, error))

  const [first] = status.videos
  if (first.type === "uploaded") { throw new Error("The video could not be made: the provider sent no file.") }

  if (first.type === "url") {
    const bytes = await download(first.url)
    const file = await store(caller, personaId, video.name, bytes, first.mediaType ?? "video/mp4")
    return file
  }

  const bytes = first.type === "base64" ? new Uint8Array(Buffer.from(first.data, "base64")) : first.data
  const file = await store(caller, personaId, video.name, bytes, first.mediaType)
  return file
}

export async function createSpeech(caller: Caller, personaId: string, input: z.input<typeof speechInput>) {
  const parsed = validate(speechInput, input)
  if (!parsed.ok) return parsed
  const { text, voice } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  // Gemini speaks only WAV, and WhatsApp refuses a WAV but plays an MP3, so the recording is stored as an MP3
  const speech = await generateSpeech({ model: SPEECH_MODEL, text, voice: voice ?? "Kore", outputFormat: "wav" })
  await chargeReply(personaId, SPEECH_MODEL, speech.providerMetadata)
  const mp3 = toMp3(speech.audio.uint8Array)
  const file = await store(caller, personaId, text, mp3, "audio/mpeg")
  return file
}

// The recording goes in as bytes, never as a link: the AI SDK fetches a link with undici, loaded by a require the hosted build cannot see, so on Vercel it fails ("Cannot find module 'undici'", vercel/ai #21499)
export async function transcribeAudio(caller: Caller, personaId: string, audio: Uint8Array) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const transcribed = await transcribe({ model: TRANSCRIBE_MODEL, audio })
  await chargeReply(personaId, TRANSCRIBE_MODEL, transcribed.providerMetadata)
  const transcript = { text: transcribed.text, language: transcribed.language ?? null, durationInSeconds: transcribed.durationInSeconds ?? null }
  return ok(transcript)
}

export async function describeMedia(caller: Caller, personaId: string, input: z.input<typeof describeInput>) {
  const parsed = validate(describeInput, input)
  if (!parsed.ok) return parsed
  const { url, question } = parsed.value

  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  // One byte by GET, since a signed link answers GET only
  const probe = await fetch(url, { headers: { Range: "bytes=0-0" } })
  await probe.body?.cancel()
  if (!probe.ok) throw new Error(`Nothing readable at that link (${probe.status}).`)

  const mediaType = probe.headers.get("content-type")?.split(";")[0] ?? mediaTypeOf(url)
  const content = [{ type: "file" as const, data: new URL(url), mediaType }, { type: "text" as const, text: question || DESCRIBE }]
  const described = await generateText({ model: READ_MODEL, messages: [{ role: "user", content }] })
  await chargeReply(personaId, READ_MODEL, described.finalStep.providerMetadata, described.usage)
  return ok({ text: described.text })
}

export function mediaTypeOf(path: string) {
  const extension = path.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  const mediaType = MEDIA_TYPES[extension] ?? "application/octet-stream"
  return mediaType
}

async function store(caller: Caller, personaId: string, description: string, bytes: Uint8Array, mediaType: string) {
  const words = description.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").slice(0, 6).join("-").slice(0, 80)
  const name = `${words || "file"}.${EXTENSIONS[mediaType] ?? "bin"}`
  const file = await saveFile(caller, personaId, { name, contentType: mediaType, bytes })
  if (!file.ok) return file
  const signedUrl = await getFileSignedUrl(caller, file.value.id)
  if (!signedUrl.ok) return signedUrl

  const saved = { fileId: file.value.id, name: file.value.name, url: signedUrl.value, mediaType }
  return ok(saved)
}

async function download(source: string) {
  const response = await fetch(source)
  if (!response.ok) throw new Error(`Could not fetch ${source} (${response.status}).`)

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return bytes
}

// A WAV's 16-bit mono samples as a 64 kbps MP3. The format comes from the header and the samples from the "data" chunk; anything else is refused with a clear error, which the tool hands back to the model
function toMp3(wav: Uint8Array) {
  const bytes = Buffer.from(wav.buffer, wav.byteOffset, wav.byteLength)
  if (bytes.byteLength < 44 || bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WAVE") throw new Error("The recording did not come back as a WAV.")

  const channels = bytes.readUInt16LE(22)
  const sampleRate = bytes.readUInt32LE(24)
  const bits = bytes.readUInt16LE(34)
  if (channels !== 1 || bits !== 16 || !MP3_RATES.includes(sampleRate)) throw new Error(`The recording came back as ${channels}-channel ${bits}-bit audio at ${sampleRate} Hz, which can't become an MP3.`)

  const dataAt = bytes.indexOf("data", 12)
  if (dataAt < 0 || dataAt + 8 > bytes.byteLength) throw new Error("The recording came back without its audio.")
  const declared = bytes.readUInt32LE(dataAt + 4)
  const stop = declared > 0 ? Math.min(dataAt + 8 + declared, bytes.byteLength) : bytes.byteLength
  const pcm = wav.slice(dataAt + 8, stop)
  const samples = new Int16Array(pcm.buffer, 0, Math.floor(pcm.byteLength / 2))

  const encoder = new Mp3Encoder(1, sampleRate, 64)
  const body = encoder.encodeBuffer(samples)
  const end = encoder.flush()
  // lamejs hands back Int8Arrays, though its types say Uint8Array, and Buffer.concat takes only bytes
  const mp3 = Buffer.concat([Buffer.from(body.buffer, body.byteOffset, body.byteLength), Buffer.from(end.buffer, end.byteOffset, end.byteLength)])
  return mp3
}

// A media call at the gateway's list price, under its generation id. A failed count is logged and the media still arrives
async function chargeReply(personaId: string, model: string, providerMetadata: unknown, usage?: LanguageModelUsage) {
  try {
    const { generationId, marketCost, gatewayCost, routing } = GENERATION.parse(providerMetadata).gateway
    if (marketCost === undefined) return console.warn("Media usage was not saved: the gateway sent no price.", model)

    const charged = await chargeModelCall(personaId, { id: generationId, model, provider: routing?.finalProvider, marketCost, gatewayCost }, usage)
    if (!charged.ok) console.warn("Media usage was not saved.", model, charged.error.message)
  } catch (error) {
    console.warn("Media usage was not saved.", model, error)
  }
}
