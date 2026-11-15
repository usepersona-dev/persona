import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { listModels, updatePersona } from "@/usecases/personas"

export default defineTool({
  description: "Set the models you run on from the next message on, each with when to use it. One model is fine: it becomes your only model. With two or more, each message runs on the one whose when fits it, so give each a when. A new model reads the whole conversation again at uncached prices, so change them when the person asks for it. Pick ids that model_list shows.",
  inputSchema: z.object({
    models: z.array(z.object({ model: z.string().min(1).describe("A gateway model id exactly as model_list shows it."), when: z.string().trim().min(1, "Say when to use each model.").describe("When to use this model, such as hard tasks with many steps.") })).min(1).max(5),
  }),
  label: { start: ({ models }) => `Set models: ${models.map((option) => option.model).join(", ")}` },
  async execute({ models }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const catalogue = await listModels()
    if (!catalogue.ok) throw new Error(catalogue.error.message)

    const unknown = models.find((option) => !catalogue.value.some((item) => item.id === option.model))
    if (unknown) throw new Error(`${unknown.model} isn't one of the models you can run on. Pick an id that model_list shows.`)

    const updated = await updatePersona(caller, personaId, { models })
    if (!updated.ok) throw new Error(updated.error.message)

    const result = { models: updated.value.models }
    return result
  },
})
