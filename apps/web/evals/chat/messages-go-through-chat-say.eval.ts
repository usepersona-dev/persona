import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { said } from "@/evals/shared"

// The person sees only what chat_say sends: an answer in steps comes as several chat_say messages, the tag of their message never shows up in one, and the turn ends with a short note nobody sees
export default defineEval<typeof config>({
  description: "Asked for three facts as separate messages, the persona sends each with chat_say, writes no tag, and closes with a short note.",
  tags: ["chat"],
  async test(t) {
    const { headers } = await t.context.makePersona()
    const turn = await t.send("[#a1b2c3] Tell me three short facts about the moon, each one as its own message.", { headers })
    t.succeeded()

    const sent = turn.toolCalls.filter((call) => call.name === "chat_say")
    t.check(sent.length, satisfies((count) => Number(count) >= 3, "the three facts arrive as at least three chat_say messages"))
    t.check(said(turn), satisfies((text) => !String(text).includes("[#"), "no message writes a tag"))
    t.check(turn.reply ?? "", satisfies((text) => String(text).trim().length > 0 && String(text).length <= 300, "the turn ends with a short closing note")).soft()
  },
})
