import { defineEval } from "eve/evals"
import { equals, includes } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker, said } from "@/evals/shared"
import { listSkills } from "@/usecases/skills"

// A skill the agent saves is marked as its own, and it loads from the next turn on
export default defineEval<typeof config>({
  description: "The agent saves a skill, which is marked as its own and loads on the next turn.",
  tags: ["skills"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const word = marker("note")

    await t.send(`Save a skill named eval-notes. Use it when I ask how to take notes. The steps: start every note with the word ${word}.`, { headers })
    t.calledTool("skill_save")

    const listed = await listSkills(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const saved = listed.value.find((skill) => skill.name === "eval-notes")
    t.check(saved?.origin, equals({ kind: "agent", id: null }))

    const turn = await t.send("How do I take notes? Use your skill.", { headers })
    t.succeeded()
    t.calledSkill("eval-notes")
    t.check(said(turn), includes(word))
  },
})
