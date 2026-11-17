import { z } from "zod"

const CATALOGUE_URL = "https://ai-gateway.vercel.sh/v1/models"

const CATALOGUE = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      owned_by: z.string(),
      context_window: z.number().nullable().catch(null),
      released: z.number().nullable().catch(null),
      tags: z.array(z.string()).catch([]),
      pricing: z.object({
        input: z.string().optional(),
        output: z.string().optional(),
      }).catch({}),
    })
  ),
})

export type GatewayModel = Awaited<ReturnType<typeof listModels>>[number]

// The language models a persona can run on, sorted by id
export async function listModels() {
  const response = await fetch(CATALOGUE_URL)
  if (!response.ok) throw new Error(`The gateway model catalogue answered ${response.status}.`)

  const body = await response.json()
  const catalogue = CATALOGUE.safeParse(body)
  if (!catalogue.success) throw new Error("The gateway model catalogue came back in a shape this agent does not understand.")

  const language = catalogue.data.data.filter((model) => model.type === "language")
  const models = language.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.owned_by,
    input: perMillion(model.pricing.input),
    output: perMillion(model.pricing.output),
    context: model.context_window,
    released: model.released,
    tags: model.tags,
  }))

  const sorted = models.sort((first, second) => first.id.localeCompare(second.id))
  return sorted
}

function perMillion(price: string | undefined) {
  if (!price) return null
  const perToken = Number(price)
  const rounded = Number((perToken * 1_000_000).toFixed(4))
  return rounded
}
