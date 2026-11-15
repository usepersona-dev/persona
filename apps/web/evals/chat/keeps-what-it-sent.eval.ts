import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { db } from "@/prisma/db"
import { saveFile } from "@/usecases/files"

// The chat tools act on their results: the sessions hook keeps one row for each message and file the persona sent, once each call has run, and each result follows its call within moments
export default defineEval<typeof config>({
  description: "Asked for one of its files with a word about it, the persona's chat_say and chat_file results reach the sessions hook, which keeps one row for each, and each result follows its call within two seconds.",
  tags: ["chat"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const name = `${marker("menu")}.md`
    const saved = await saveFile(caller, personaId, { name, contentType: "text/markdown", bytes: new TextEncoder().encode("# Menu\n\nSoup, bread, tea.") })
    if (!saved.ok) throw new Error(saved.error.message)

    const turn = await t.send(`Send me my file ${name}, and tell me in one short message what it is.`, { headers })
    t.succeeded()
    t.calledTool("chat_file")
    t.calledTool("chat_say")

    const rows = await db.orm.public.Message.where({ sessionId: turn.sessionId, role: "assistant" }).all()
    const sayRows = rows.filter((row) => row.tool === "chat_say")
    const fileRows = rows.filter((row) => row.tool === "chat_file")
    const sayCalls = turn.toolCalls.filter((call) => call.name === "chat_say")
    t.check(sayRows.map((row) => row.text).join("\n"), satisfies((text) => text === said(turn), "the hook keeps each message, once, as sent"))
    t.check(fileRows.length, satisfies((count) => count === 1, "the hook keeps the file once"))
    t.check(JSON.stringify(fileRows[0]?.files ?? null), satisfies((files) => String(files).includes("X-Amz-Signature") && String(files).includes(name), "the file row holds the file's signed link and name"))
    t.check(sayRows.length, satisfies((count) => count === sayCalls.length, "no message row is missing or doubled"))

    // When each chat call was asked for and when its result came back, from the turn's own events
    const asked = new Map<string, number>()
    const answered = new Map<string, number>()
    for (const event of turn.events) {
      const at = Date.parse(event.meta.at)
      if (event.type === "call.requested" && event.data.capability.name.startsWith("chat_")) asked.set(event.data.callId, at)
      if (event.type === "call.settled" && asked.has(event.data.callId)) answered.set(event.data.callId, at)
    }
    const delays = [...asked].map(([callId, at]) => (answered.get(callId) ?? Infinity) - at)
    const worst = Math.max(...delays)
    t.check(worst, satisfies((ms) => Number(ms) < 2000, `each chat result follows its call within two seconds (worst ${worst} ms over ${delays.length} calls)`))
  },
})
