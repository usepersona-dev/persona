import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { createImage } from "@/usecases/media"

export default defineWorkflowTool({
  description: "Draw a new image from a description. It is saved to your files and you get back its fileId and a link that works for 30 minutes. Use media_image_edit instead when you are changing an image that already exists. It draws in the background and the result arrives in a later message, so say what you are drawing and carry on.",
  inputSchema: z.object({
    prompt: z.string().min(1).max(8000).describe("What to draw, in detail."),
  }),
  label: { start: ({ prompt }) => `Draw ${prompt}` },
  async task({ prompt }, ctx) {
    "use workflow"
    const image = await draw(ctx, prompt)
    return image
  },
})

async function draw(ctx: WorkflowStepToolContext, prompt: string) {
  "use step"
  const { caller, personaId } = readCaller(ctx)

  const image = await createImage(caller, personaId, { prompt })
  if (!image.ok) throw new Error(image.error.message)

  const drawn = { fileId: image.value.fileId, url: image.value.url }
  return drawn
}
