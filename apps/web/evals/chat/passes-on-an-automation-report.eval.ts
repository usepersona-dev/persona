import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { said } from "@/evals/shared"

// An automation's report reaches a chat as a message to the persona, in the words the automations channel's report route gives it, and only chat_say reaches the person, so the persona has to pass the report on with chat_say
export default defineEval<typeof config>({
  description: "Given an automation report in a chat, the persona tells the person what came of it with chat_say.",
  tags: ["chat"],
  async test(t) {
    const { headers } = await t.context.makePersona()
    const opened = await t.send("Hi! Just checking in.", { headers })
    t.succeeded()

    const report = `Your automation "Dentist check" just ran on its own; this isn't a message from the person. Open the conversation. Tell them what came of it, in your own words:\n\nDr. Levi's office moved the cleaning to Thursday at 4:15 PM.`
    const turn = await opened.session.send(report, { headers })
    turn.succeeded()
    turn.calledTool("chat_say")
    t.check(said(turn), satisfies((text) => /4:15/.test(String(text)), "the person hears the new time"))
  },
})
