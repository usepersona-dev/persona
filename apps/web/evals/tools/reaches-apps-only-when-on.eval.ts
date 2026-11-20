import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { called, found } from "@/evals/shared"
import { updateTool } from "@/usecases/tools"

// The persona reaches connected apps only while its creator leaves Apps switched on: switched off, the apps tools are out of its tool search, and they are back from the next message once it is on again
export default defineEval<typeof config>({
  description: "The persona has its apps tools only while Apps is switched on, and a switch applies from the next message.",
  tags: ["tools"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()

    const appsOff = await updateTool(caller, personaId, "apps", { enabled: false })
    if (!appsOff.ok) throw new Error(appsOff.error.message)

    const first = await t.send("Look through your tools for the ones that work in connected apps, such as Gmail or Google Calendar, and tell me the name of one. If you have none, just tell me, without changing any settings or handing it to anyone else.", { headers })
    t.check(called(first).some((name) => name.startsWith("apps__")), satisfies((value) => value === false, "no apps tool is called while Apps is off"))
    t.check(found(first).some((name) => name.startsWith("apps__")), satisfies((value) => value === false, "and the tool search brings none of them back"))

    const appsOn = await updateTool(caller, personaId, "apps", { enabled: true })
    if (!appsOn.ok) throw new Error(appsOn.error.message)

    const second = await first.session.send("Check again: look through your tools for the ones that work in connected apps, and tell me the name of one.", { headers })
    const reached = called(second).some((name) => name.startsWith("apps__")) || found(second).some((name) => name.startsWith("apps__"))
    t.check(reached, satisfies((value) => value === true, "switched on, the apps tools are back on the next message"))
    t.succeeded()
  },
})
