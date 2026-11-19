import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { said } from "@/evals/shared"

// A reply or one quick tool call stays with the persona, each ask in its own chat. The weather ask sits on the line, so it only warns
const ASKS: { label: string; text: string; sent?: RegExp; tool?: string; onTheLine?: boolean }[] = [
  { label: "math", text: "What's 18% of 250?", sent: /45/ },
  { label: "translation", text: "How do you say good morning in French?", sent: /bonjour/i },
  { label: "one note", text: "Save a note: buy milk and eggs.", tool: "note_create" },
  { label: "one lookup", text: "What's the weather in Tel Aviv tomorrow?", onTheLine: true },
]

export default defineEval<typeof config>({
  description: "Asked for a reply or a quick tool call or two, the persona does it itself and starts no subagent.",
  tags: ["chat", "long-tasks"],
  async test(t) {
    const { headers } = await t.context.makePersona()
    await Promise.all(ASKS.map(async (ask) => {
      const begun = Date.now()
      const turn = await t.send(ask.text, { headers })

      const subagent = turn.events.some((event) => event.type === "task.started" && event.data.kind === "agent")
      const tools = turn.toolCalls.filter((call) => call.sessionId === turn.sessionId).map((call) => call.name)
      t.log(`${ask.label} | subagent ${subagent ? "yes" : "no"} | tools ${tools.join(", ") || "-"} | turn ${Math.round((Date.now() - begun) / 1000)} s`)

      const itself = satisfies((value) => value === false, `${ask.label}: it does it itself`)
      t.check(subagent, ask.onTheLine ? itself.soft() : itself)

      const pattern = ask.sent
      if (pattern) t.check(said(turn), satisfies((text) => pattern.test(String(text)), `${ask.label}: it answers`)).soft()

      const tool = ask.tool
      if (tool) t.check(tools.join(", "), satisfies((text) => String(text).includes(tool), `${ask.label}: it calls ${tool}`)).soft()
    }))
    t.succeeded()
  },
})
