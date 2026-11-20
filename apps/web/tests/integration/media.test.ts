import assert from "node:assert/strict"
import { afterAll, beforeAll, test } from "vitest"

import { mediaRead } from "@/agent/tools/media_read"
import { mediaSpeech } from "@/agent/tools/media_speech"
import { mediaTranscribe } from "@/agent/tools/media_transcribe"
import { s3Files } from "@/lib/s3"
import { db } from "@/prisma/db"
import { listFiles } from "@/usecases/files"
import { createImage, editImage, readVideo, startVideo } from "@/usecases/media"
import { createTestPersona, run, toolContext } from "@/tests/helpers"

let persona: Awaited<ReturnType<typeof createTestPersona>>
let context: never
const saved: string[] = [] // keys in the files bucket // keys in the bucket

beforeAll(async () => {
  persona = await createTestPersona("media")
  context = toolContext(persona.caller, persona.personaId)
})

afterAll(async () => {
  await persona.cleanup()
  const left = await Promise.all(saved.map((key) => s3Files.head(key)))
  assert.ok(left.every((object) => object === null), "removing the persona deletes its media")
  await db.close()
})

test("speech: record text into the files as an MP3, then transcribe it back", async () => {
  const recording = await run(mediaSpeech(), { text: "The secret word is pineapple." }, context)
  saved.push(`${persona.personaId}/${recording.fileId}`)
  assert.ok(recording.url.includes("X-Amz-Signature"), "the link is signed")

  const served = await fetch(recording.url, { headers: { Range: "bytes=0-0" } })
  assert.equal(served.headers.get("content-type"), "audio/mpeg", "WhatsApp plays an MP3 but refuses a WAV")

  const transcript = await run(mediaTranscribe(), { fileId: recording.fileId }, context)
  assert.match(transcript.text, /pineapple/i)
})

test("images: draw one, edit it, read it back, and both land in the files", async () => {
  const drawn = await createImage(persona.caller, persona.personaId, { prompt: "A single yellow lemon on a plain white table, flat illustration." })
  assert.ok(drawn.ok)
  saved.push(`${persona.personaId}/${drawn.value.fileId}`)
  assert.match(drawn.value.mediaType, /^image\//)

  const edited = await editImage(persona.caller, persona.personaId, { images: [drawn.value.url], prompt: "Make the lemon green." })
  assert.ok(edited.ok)
  saved.push(`${persona.personaId}/${edited.value.fileId}`)

  const reading = await run(mediaRead(), { url: edited.value.url, question: "What fruit is this and what color is it? Answer in a few words." }, context)
  assert.match(reading.text, /lemon|lime/i)
  assert.match(reading.text, /green/i)

  const files = await listFiles(persona.caller, persona.personaId)
  assert.ok(files.ok)
  const ids = files.value.map((file) => file.id)
  assert.ok(ids.includes(drawn.value.fileId) && ids.includes(edited.value.fileId))
  assert.ok(files.value.some((file) => file.name === "a-single-yellow-lemon-on-a.png" || file.name.startsWith("a-single-yellow-lemon")))
})

// Costs money and takes minutes, so it runs only with TEST_VIDEO=1
test("video: film a short clip", { skip: process.env.TEST_VIDEO !== "1" }, async () => {
  const video = await startVideo(persona.caller, persona.personaId, { prompt: "A lemon rolling across a white table." })
  assert.ok(video.ok)
  for (let check = 0; check < 40; check++) {
    await new Promise((resolve) => setTimeout(resolve, 15_000))
    const film = await readVideo(persona.caller, persona.personaId, video.value)
    assert.ok(film.ok)
    if (!film.value) continue

    saved.push(`${persona.personaId}/${film.value.fileId}`)
    assert.match(film.value.mediaType, /^video\//)
    return
  }
  assert.fail("The video wasn't ready after ten minutes.")
})
