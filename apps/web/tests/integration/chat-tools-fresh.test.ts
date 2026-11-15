import assert from "node:assert/strict"
import { afterAll, test } from "vitest"

import { db } from "@/prisma/db"

// On Vercel the chat tools run in a workflow step: a fresh function that never took a webhook, so nothing has connected the Chat SDK's state store there. This file imports the channels and calls their handlers before anything else touches them, as that function does

afterAll(async () => {
  await db.close()
})

test("a chat tool call in a fresh function, before any webhook, still reads the message tags", async () => {
  const whatsapp = await import("@/agent/channels/whatsapp")
  const telegram = await import("@/agent/channels/telegram")
  const reaction = { kind: "tool-call", callId: "call_fresh", toolName: "chat_react", input: { emoji: "👍" } }

  const channels = [
    { events: whatsapp.events, threadId: whatsapp.encodeThreadId("000000", "15550000000", "nobody") },
    { events: telegram.events, threadId: telegram.encodeThreadId("1", "1", "nobody") },
  ]
  for (const { events, threadId } of channels) {
    const thread = { id: threadId, post: async () => undefined, startTyping: async () => undefined }
    const handle = events["call.requested"]
    assert.ok(handle)
    await assert.doesNotReject(async () => await handle({ type: "call.requested", data: { callId: reaction.callId, owner: { runId: "run_fresh" }, capability: { kind: "tool", name: reaction.toolName }, input: reaction.input }, scope: { turnId: "turn_fresh" } } as never, { channel: { thread } } as never))
  }
})
