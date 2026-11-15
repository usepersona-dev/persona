import { defineEval } from "eve/evals"
import { includes } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { said } from "@/evals/shared"
import { installMarketplaceSkill } from "@/usecases/skills"

// A skill installed from skills.sh brings its files. The agent loads it, then reads one of them from the skill's folder in its sandbox: only that file holds its top heading
export default defineEval<typeof config>({
  description: "The agent loads a skill installed from skills.sh and reads one of its files.",
  tags: ["skills"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()

    const installed = await installMarketplaceSkill(caller, personaId, "anthropics/skills/pdf")
    if (!installed.ok) throw new Error(installed.error.message)
    const reference = installed.value.files.find((file) => file.path === "reference.md")
    if (!reference) throw new Error("anthropics/skills/pdf has no reference.md.")
    const heading = reference.contents.split("\n").find((line) => line.startsWith("# "))?.slice(2).trim()
    if (!heading) throw new Error("reference.md has no top heading.")

    const turn = await t.send("Load your pdf skill, then open reference.md from the skill's folder and tell me its top heading, word for word.", { headers })
    t.succeeded()
    t.calledSkill("pdf")
    t.check(said(turn), includes(heading))
  },
})
