import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { editImage } from "@/usecases/media"

export default defineWorkflowTool({
  description: "Change images that already exist: give their links and say what should be different, such as a new style, combining them, or taking something out or adding something in. The new image is saved to your files and you get back its fileId and a link that works for 30 minutes. It works in the background and the result arrives in a later message, so say what you are doing and carry on.",
  inputSchema: z.object({
    images: z.array(z.url()).min(1).max(10).describe("Links to the images to change."),
    prompt: z.string().min(1).max(8000).describe("What should be different."),
  }),
  label: { start: ({ prompt }) => `Edit an image: ${prompt}` },
  async task({ images, prompt }, ctx) {
    "use workflow"
    const image = await edit(ctx, images, prompt)
    return image
  },
})

async function edit(ctx: WorkflowStepToolContext, images: string[], prompt: string) {
  "use step"
  const { caller, personaId } = readCaller(ctx)

  const image = await editImage(caller, personaId, { images, prompt })
  if (!image.ok) throw new Error(image.error.message)

  const edited = { fileId: image.value.fileId, url: image.value.url }
  return edited
}
