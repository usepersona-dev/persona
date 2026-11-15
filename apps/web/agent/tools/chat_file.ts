import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller, RUN_CHANNELS } from "@/usecases/agent"
import { getFile, getFileSignedUrl } from "@/usecases/files"

// The chat's channel sends the file as media once this has run, by the signed link, name and type it returns, which the model does not see; a made-up id fails here, so nothing goes out and the model knows. The web chat shows it by its id. A copy of the persona started with the agent tool has no chat, so it does not get this tool. A run of an automation, trigger or webhook has no chat either, so there the call fails and tells the model to put the file's link in its result

export const fileInput = z.object({
  fileId: z.string().min(1).describe("The file's id."),
})

export default defineTool({
  availableInSubagents: false,
  description: "Send a file to the person as a real photo, voice note, video or document. Give its id. Say what it is with chat_say, not here. Never call it in parallel with chat_say or another chat_file.",
  inputSchema: fileInput,
  label: { start: () => "Send a file" },
  async execute({ fileId }, ctx) {
    const { caller, channel } = readCaller(ctx)
    if (RUN_CHANNELS.includes(channel)) throw new Error("A run has no chat, so nothing you send here reaches the person. Put the file's link in your result, with notify true.")

    const [file, signedUrl] = await Promise.all([getFile(caller, fileId), getFileSignedUrl(caller, fileId)])
    if (!file.ok || !signedUrl.ok) throw new Error("That file id is not real.")

    return { id: file.value.id, url: signedUrl.value, name: file.value.name, contentType: file.value.contentType, size: file.value.size }
  },
  toModelOutput: () => ({ type: "json", value: { sent: true } }),
})
