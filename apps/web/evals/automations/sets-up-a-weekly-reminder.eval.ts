import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { listAutomations } from "@/usecases/automations"

// Asked for something on a schedule, the persona sets up an automation of its own under the name the person gave, and tells them
export default defineEval<typeof config>({
  description: "Asked for a weekly reminder, the persona creates an automation under that name and confirms it.",
  tags: ["automations"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const name = marker("Plants")

    const turn = await t.send(`Every Monday at 9:00 in the morning, Israel time, remind me to water the plants. Call the automation ${name}.`, { headers })
    t.succeeded()
    t.calledTool("automation_create")

    const listed = await listAutomations(caller, personaId)
    const automation = listed.ok ? listed.value.find((item) => item.name === name) : undefined
    await t.require(automation, satisfies((value) => value !== undefined, "the automation exists under that name"))
    t.check(said(turn), satisfies((text) => String(text).trim().length > 0, "it tells the person"))

    // How a run's message gets sent is ours, not the task's: the task the persona writes says what to do, and nothing about chat tools or a run's output
    t.check(automation?.prompt, satisfies((text) => !/chat_say|chat_react|chat_file|notify|\boutput\b|\bresult\b/i.test(String(text)), "the task says what to do, not how to send it"))
  },
})
