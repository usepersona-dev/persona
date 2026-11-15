import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools"
import { sleep } from "eve/workflow"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { readVideo, startVideo, type StartedVideo } from "@/usecases/media"

const CHECK_EVERY = "15s"
const CHECKS = 40

export default defineWorkflowTool({
  description: "Film a short video from a description. It is saved to your files and you get back its fileId and a link that works for 30 minutes. It takes minutes, works in the background and arrives in a later message, so tell them it is coming and carry on.",
  inputSchema: z.object({
    prompt: z.string().min(1).max(8000).describe("What to film, in detail."),
  }),
  label: { start: ({ prompt }) => `Film ${prompt}` },
  async task({ prompt }, ctx) {
    "use workflow"
    const video = await begin(ctx, prompt)

    for (let check = 0; check < CHECKS; check++) {
      await sleep(CHECK_EVERY)
      const film = await collect(ctx, video)
      if (film) return film
    }

    throw new Error("The video still wasn't ready after ten minutes, so it was given up on.")
  },
})

async function begin(ctx: WorkflowStepToolContext, prompt: string) {
  "use step"
  const { caller, personaId } = readCaller(ctx)

  const video = await startVideo(caller, personaId, { prompt })
  if (!video.ok) throw new Error(video.error.message)

  return video.value
}

async function collect(ctx: WorkflowStepToolContext, video: StartedVideo) {
  "use step"
  const { caller, personaId } = readCaller(ctx)

  const saved = await readVideo(caller, personaId, video)
  if (!saved.ok) throw new Error(saved.error.message)
  if (!saved.value) return null

  const film = { fileId: saved.value.fileId, url: saved.value.url }
  return film
}
