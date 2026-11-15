import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller, RUN_CHANNELS } from "@/usecases/agent"

// The persona's only voice in a chat. The tool passes the message through: the chat's channel posts it once the call has run, and the web chat shows the call as a message. The model sees only that it was sent, not its own text again. A copy of the persona started with the agent tool has no chat, so it does not get this tool: what it sent would reach no one. A run of an automation, trigger or webhook has no chat either, so there the call fails and tells the model to put the message in its result

export const sayInput = z.object({
  text: z.string().trim().min(1).max(4000).describe("The message, written the way you talk."),
  replyTo: z.string().trim().min(1).optional().describe("The tag of one of the person's messages to reply to, like 825, so it shows as a quote. Leave it out to just send."),
})

export default defineTool({
  availableInSubagents: false,
  description: "Send the person one message, right now. This is the only way they see anything you write. Call it once per message, one at a time, in the order you want them read: parallel calls can arrive out of order.",
  inputSchema: sayInput,
  label: { start: ({ text }) => `Say: ${text}` },
  async execute(input, ctx) {
    const { channel } = readCaller(ctx)
    if (RUN_CHANNELS.includes(channel)) throw new Error("A run has no chat, so nothing you send here reaches the person. Put the message in your result, with notify true.")

    return input
  },
  toModelOutput: () => ({ type: "json", value: { sent: true } }),
})
