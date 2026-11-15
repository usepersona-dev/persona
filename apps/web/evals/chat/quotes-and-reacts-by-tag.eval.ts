import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { said } from "@/evals/shared"

// On WhatsApp and Telegram each of the person's messages starts with a tag: the persona points at a message with it, as chat_react's to and chat_say's replyTo, and never writes it
export default defineEval<typeof config>({
  description: "Asked to react to a tagged message and to reply quoting it, the persona uses the tag in chat_react and chat_say.",
  tags: ["chat"],
  async test(t) {
    const { headers } = await t.context.makePersona()
    const turn = await t.send("[#4f2a9c] Put a thumbs up on this message, then reply to it, quoting it, with the word done.", { headers })
    t.succeeded()

    const reaction = turn.toolCalls.find((call) => call.name === "chat_react")
    await t.require(reaction, satisfies((call) => call !== undefined, "it reacts with chat_react"))
    t.check(String(reaction?.input.to ?? "4f2a9c").replace(/^#/, ""), satisfies((tag) => tag === "4f2a9c", "the reaction lands on the tagged message, or on the latest, which is the same one"))

    const reply = turn.toolCalls.find((call) => call.name === "chat_say" && call.input.replyTo !== undefined)
    await t.require(reply, satisfies((call) => call !== undefined, "it replies with a chat_say that has a replyTo"))
    t.check(String(reply?.input.replyTo ?? "").replace(/^#/, ""), satisfies((tag) => tag === "4f2a9c", "the reply quotes the tagged message"))
    t.check(said(turn), satisfies((text) => !String(text).includes("[#"), "no message writes a tag"))
  },
})
