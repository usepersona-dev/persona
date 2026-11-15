import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { describeMedia } from "@/usecases/media"

export default defineTool({
  description: "Describe a file in words, or answer one question about it. Give it a link to a photo, screenshot, video, recording, PDF or document. This is how you see a file at a link. It only reads, never changes.",
  inputSchema: z.object({
    url: z.url(),
    question: z.string().max(2000).optional().describe("Something specific to find out, such as the total on a receipt. Leave it out to get everything the file holds, which is better while you are still working out what it is."),
  }),
  label: { start: ({ question }) => (question ? `Read a file: ${question}` : "Read a file") },
  async execute({ url, question }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const reading = await describeMedia(caller, personaId, { url, question })
    if (!reading.ok) throw new Error(reading.error.message)

    return reading.value
  },
})
