import { defineDynamic, defineTool } from "eve/tools"
import { z } from "zod"

import { readPersonaState } from "@/agent/lib/states/persona"
import { readCaller } from "@/usecases/agent"
import { createSpeech, VOICES } from "@/usecases/media"

export const mediaSpeech = (deferred = false) => defineTool({
  deferred,
  description: "Say text out loud as a recording, saved to your files with its fileId to send, for when the person would rather listen than read.",
  inputSchema: z.object({
    text: z.string().min(1).max(4096),
    voice: z.enum(VOICES).optional().describe("Kore, Zephyr and Leda are women's voices; Puck and Charon are men's. Defaults to Kore."),
  }),
  label: { start: ({ text }) => `Record ${text.slice(0, 40)}` },
  async execute({ text, voice }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const recording = await createSpeech(caller, personaId, { text, voice })
    if (!recording.ok) throw new Error(recording.error.message)

    const result = { fileId: recording.value.fileId, url: recording.value.url }
    return result
  },
})

export default defineDynamic(() => {
  const { tools } = readPersonaState()
  const family = tools.media_audio
  if (!family.enabled) return null
  return mediaSpeech(family.deferred)
})
