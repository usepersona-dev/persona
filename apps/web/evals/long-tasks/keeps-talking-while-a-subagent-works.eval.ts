import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { waitFor } from "@/evals/shared"

// A job of a few searches goes to a subagent, and the persona keeps talking while it runs. The quick question steers the running turn, as WhatsApp and Telegram messages do, and eve holds the turn open until the subagent is done. The chat opens with a hello because our eve channel serves a session only once its first turn has written its row, so t.session() can't prewarm one
const JOB = "Search for 3 easy pasta recipes, compare their cooking times, and send me the quickest one."
const QUESTION = "Quick question meanwhile: what's the capital of Japan?"
const NOT_WORK = ["chat_say", "chat_react", "chat_file", "agent", "eve__task_wait", "eve__task_cancel"]

export default defineEval<typeof config>({
  description: "Given a job of a few searches, the persona hands it to a subagent, says it's underway, answers a quick question while the subagent works, then tells what the subagent found.",
  tags: ["chat", "long-tasks"],
  async test(t) {
    const { headers } = await t.context.makePersona()
    const opened = await t.send("Hi!", { headers })
    const session = opened.session
    const begun = Date.now()
    const live = await session.start(JOB, { headers })

    const firstSay = await waitFor(async () => live.events.find((event) => event.type === "call.requested" && event.data.capability.name === "chat_say"), 90_000)
    const askedAt = Date.now()
    await session.start(QUESTION, { turnPolicy: "steer", headers })
    const turn = await live.result()

    const events = turn.events
    const texts = new Map(turn.toolCalls.map((call) => [call.callId, String(call.input.text ?? "")]))
    const subagents = events.flatMap((event) => (event.type === "task.started" && event.data.kind === "agent" ? [event.data.startedBy.callId] : []))
    const started = events.findIndex((event) => event.type === "task.started" && event.data.kind === "agent")
    // A subagent parks after it answers, so its task doesn't end with the turn; the call that started it settles when its reply comes in
    const ended = events.findLastIndex((event) => event.type === "call.settled" && subagents.includes(event.data.callId))
    const says = events.flatMap((event, index) => (event.type === "call.requested" && event.data.capability.name === "chat_say" ? [{ index, at: Date.parse(event.meta.at), text: texts.get(event.data.callId) ?? "" }] : []))
    const answer = says.find((say) => /tokyo/i.test(say.text))
    const result = says.filter((say) => ended >= 0 && say.index > ended)
    const ownWork = turn.toolCalls.filter((call) => call.sessionId === turn.sessionId && !NOT_WORK.includes(call.name)).map((call) => call.name)

    const firstSeconds = firstSay ? Math.round((Date.parse(firstSay.meta.at) - begun) / 1000) : -1
    const answerSeconds = answer ? Math.round((answer.at - askedAt) / 1000) : -1
    const subagentSeconds = ended >= 0 ? Math.round((Date.parse(events[ended].meta.at) - begun) / 1000) : -1
    t.log(`subagents ${subagents.length} | first message ${firstSeconds} s | quick answer ${answerSeconds} s after asking | subagent done ${subagentSeconds} s | own work tools: ${ownWork.join(", ") || "none"} | turn ${Math.round((Date.now() - begun) / 1000)} s`)

    t.check(subagents.length, satisfies((count) => Number(count) > 0, "it hands the job to a subagent"))
    t.check(says[0]?.index ?? -1, satisfies((index) => Number(index) >= 0 && Number(index) < ended, "it says the job is underway before the subagent is done"))
    t.check(answer?.index ?? -1, satisfies((index) => Number(index) >= 0 && Number(index) < ended, "it answers the quick question while the subagent works"))
    t.check(result.length, satisfies((count) => Number(count) > 0, "it tells the person the result after the subagent is done"))
    t.check(says.map((say) => say.text).join("\n"), satisfies((text) => !/sub-?agent|agent tool/i.test(String(text)), "it never mentions a subagent to the person"))
    t.check(answerSeconds, satisfies((seconds) => Number(seconds) >= 0 && Number(seconds) <= 45, "the quick answer comes within 45 s")).soft()
    t.check(started, satisfies((index) => Number(index) >= 0 && Number(index) < (says[0]?.index ?? Infinity), "it starts the subagent before its first message")).soft()
    t.check(ownWork.length, satisfies((count) => Number(count) <= 2, "it does at most two quick tool calls itself")).soft()
    t.check(result.map((say) => say.text).join("\n"), satisfies((text) => /min/i.test(String(text)), "the result has the cooking time")).soft()
    t.succeeded()
  },
})
