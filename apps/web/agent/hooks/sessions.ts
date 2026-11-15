import { call, idle } from "eve/events"
import { defineHook, type HookContext } from "eve/hooks"
import { toolResultFrom } from "eve/tools"

import chatFile from "@/agent/tools/chat_file"
import chatSay from "@/agent/tools/chat_say"
import { readCaller } from "@/usecases/agent"
import { recordMessage, recordSessionEnd, recordSessionWaiting, recordTurnStart } from "@/usecases/sessions"

// The tag a chat channel puts before each of the person's messages, so the persona can point at one; the stored text goes without it
const TAG = /^\[#[0-9a-f]+\] /

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const { caller, personaId, channel } = readCaller(ctx)
      await recordTurnStart({ sessionId: ctx.session.id, personaId, userId: caller.userId, channel, address: ctx.channel.continuationToken, at: ctx.now.toISOString() }).catch((error) => console.error("Could not record a turn start.", error))
    },

    // A settled turn leaves the session waiting for the next message, unless more is queued; a failed one also leaves a row the chat history shows
    async "turn.settled"(event, ctx) {
      if (idle(ctx.view)) await recordSessionWaiting(ctx.session.id).catch((error) => console.error("Could not record a waiting session.", error))
      if (event.data.outcome !== "failed") return
      const text = `Failed: ${event.data.error?.message ?? "the turn failed."}`
      await recordMessage({ id: rowId(ctx), sessionId: ctx.session.id, turnId: event.data.turnId, role: "system", text, at: ctx.now.toISOString() }).catch((error) => console.error("Could not record a failed turn.", error))
    },

    async "session.ended"(event, ctx) {
      const status = event.data.outcome === "failed" ? "failed" : "ended"
      await recordSessionEnd(ctx.session.id, status, ctx.now.toISOString()).catch((error) => console.error("Could not record a session end.", error))
    },

    async "delivery.consumed"(event, ctx) {
      const text = event.data.parts.flatMap((part) => (part.kind === "text" ? [part.text] : [])).join("\n")
      const files = event.data.parts.flatMap((part) => (part.kind === "file" ? [{ name: part.filename ?? null, type: part.mediaType, size: part.size ?? null, url: part.url ?? null }] : []))
      await recordMessage({ id: rowId(ctx), sessionId: ctx.session.id, turnId: event.data.turnId, role: "user", text: text.replace(TAG, ""), files: files.length > 0 ? files : undefined, at: ctx.now.toISOString() }).catch((error) => console.error("Could not record a message.", error))
    },

    // The persona's own text reaches no one, so its row names no tool: in practice it is the closing line of a turn
    async "content.completed"(event, ctx) {
      if (event.data.kind !== "text" || typeof event.data.value !== "string") return
      const text = event.data.value.trim()
      if (text === "") return
      await recordMessage({ id: rowId(ctx), sessionId: ctx.session.id, turnId: event.scope?.turnId ?? "", role: "assistant", text, at: ctx.now.toISOString() }).catch((error) => console.error("Could not record a message.", error))
    },

    // The persona talks only through the chat tools, so its messages are what it said and the files it sent, kept once each call has run; a call that failed or did not run keeps no row
    async "call.settled"(event, ctx) {
      const called = call(ctx.view, event.data.callId)
      if (!called) return

      const said = toolResultFrom(called, chatSay)
      const sent = toolResultFrom(called, chatFile)
      if (!said && !sent) return

      const message = { id: rowId(ctx), sessionId: ctx.session.id, turnId: called.turnId ?? event.scope?.turnId ?? "", role: "assistant" as const, tool: called.name, at: ctx.now.toISOString() }
      if (said) await recordMessage({ ...message, text: said.output.text }).catch((error) => console.error("Could not record a message.", error))
      if (sent) await recordMessage({ ...message, text: "", files: [{ name: sent.output.name, type: sent.output.contentType, size: sent.output.size, url: sent.output.url }] }).catch((error) => console.error("Could not record a message.", error))
    },

    async "context.settled"(event, ctx) {
      if (event.data.kind !== "clear" || event.data.outcome !== "completed") return
      await recordMessage({ id: rowId(ctx), sessionId: ctx.session.id, turnId: event.scope?.turnId ?? "", role: "system", text: "Chat cleared", at: ctx.now.toISOString() }).catch((error) => console.error("Could not record a cleared chat.", error))
    },
  },
})

function rowId(ctx: HookContext) {
  return `${ctx.session.id}:${ctx.position.line}:${ctx.position.index}`
}
