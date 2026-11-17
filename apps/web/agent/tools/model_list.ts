import { defineTool } from "eve/tools"
import { z } from "zod"

import type { GatewayModel } from "@/lib/ai-gateway"
import { listModels } from "@/usecases/personas"

const LIMIT = 20

const SORTS = {
  name: (first: GatewayModel, second: GatewayModel) => first.name.localeCompare(second.name),
  price: (first: GatewayModel, second: GatewayModel) => (first.input ?? Number.POSITIVE_INFINITY) - (second.input ?? Number.POSITIVE_INFINITY),
  context: (first: GatewayModel, second: GatewayModel) => (second.context ?? 0) - (first.context ?? 0),
  newest: (first: GatewayModel, second: GatewayModel) => (second.released ?? 0) - (first.released ?? 0),
}

export default defineTool({
  description: "Find models you could run on. Filter by what the work needs, such as vision, a wide context window or a low price. Every model that comes back can use tools, so it can run you. Only the first 20 matches come back, so narrow the filters rather than look for another page. Each model comes with its provider, its price per million tokens in and out, its context window and its tags. model_me shows the models you run on now, and model_set sets them.",
  inputSchema: z.object({
    search: z.string().optional().describe("Part of a model id or name, such as claude or gemini. A provider name such as openai brings back everything that provider serves."),
    tags: z.array(z.string()).optional().describe("Every model that comes back carries all of these, such as vision, reasoning, file-input, web-search or fast."),
    minContext: z.number().int().min(0).optional().describe("The smallest context window, in tokens."),
    sort: z.enum(["name", "price", "context", "newest"]).optional().describe("name is alphabetical, price is cheapest input first, context is widest first, newest is most recently released first."),
  }),
  label: { start: () => "List models" },
  async execute({ search, tags, minContext, sort }) {
    const catalogue = await listModels()
    if (!catalogue.ok) throw new Error(catalogue.error.message)

    const needle = (search ?? "").toLowerCase()
    const wanted = tags ?? []
    const matched = catalogue.value.filter((model) => (model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle)) && wanted.every((tag) => model.tags.includes(tag)) && (model.context ?? 0) >= (minContext ?? 0))
    const listed = matched.sort(SORTS[sort ?? "name"]).slice(0, LIMIT)

    const result = { models: listed.map((model) => ({ id: model.id, name: model.name, provider: model.provider, input: model.input, output: model.output, context: model.context, tags: model.tags })), shown: listed.length, total: matched.length }
    return result
  },
})
