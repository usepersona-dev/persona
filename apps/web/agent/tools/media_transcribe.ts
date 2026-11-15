import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { readFile } from "@/usecases/files"
import { transcribeAudio } from "@/usecases/media"

export default defineTool({
  description: "Write down word for word what is said in a saved recording, with its language and how long it runs. Use media_read instead to learn what a file is rather than exactly what was said.",
  inputSchema: z.object({
    fileId: z.string().min(1).describe("The recording's file id."),
  }),
  label: { start: () => "Transcribe a recording" },
  async execute({ fileId }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const file = await readFile(caller, fileId)
    if (!file.ok) throw new Error(file.error.message)

    const transcript = await transcribeAudio(caller, personaId, file.value.bytes)
    if (!transcript.ok) throw new Error(transcript.error.message)

    return transcript.value
  },
})
