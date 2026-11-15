import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller, RUN_CHANNELS } from "@/usecases/agent"

// Passes the reaction through: the chat's channel puts the emoji on the person's message once the call has run, and the web chat shows it as a chip. The model sees only that it reacted. A copy of the persona started with the agent tool has no chat, so it does not get this tool. A run of an automation, trigger or webhook has no chat either, so there the call fails

export const reactInput = z.object({
  emoji: z.string().trim().min(1).max(2).describe("One emoji. 2 characters is the maximum length for WhatsApp."),
  to: z.string().trim().min(1).optional().describe("The tag of the message to react to, like 825. Leave it out for their latest message."),
})

export default defineTool({
  availableInSubagents: false,
  description: "React to one of the person's messages with one emoji, the way a person would, when a reaction says it better than words.",
  inputSchema: reactInput,
  label: { start: ({ emoji }) => `React ${emoji}` },
  async execute(input, ctx) {
    const { channel } = readCaller(ctx)
    if (RUN_CHANNELS.includes(channel)) throw new Error("A run has no chat, so a reaction reaches no one. Put what matters in your result.")

    return input
  },
  toModelOutput: () => ({ type: "json", value: { reacted: true } }),
})
