import { gateway } from "ai"
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

const GATEWAY_CALL = z.object({
  usage: z.object({
    inputTokens: z.number().default(0),
    outputTokens: z.number().default(0),
    inputTokenDetails: z.object({
      cacheReadTokens: z.number().default(0),
      cacheWriteTokens: z.number().default(0),
    }).prefault({}),
    outputTokenDetails: z.object({
      reasoningTokens: z.number().default(0),
    }).prefault({}),
  }).prefault({}),
  providerMetadata: z.object({
    gateway: z.object({
      generationId: z.string().optional(),
      marketCost: z.coerce.number().default(0),
      cost: z.coerce.number().default(0),
      gatewayCost: z.coerce.number().optional().catch(undefined),
      routing: z.object({
        originalModelId: z.string().default("unknown"),
        finalProvider: z.string().nullable().default(null),
      }).prefault({}),
    }).prefault({}),
  }).prefault({}),
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

// A model's list price per token, from the model list the AI SDK keeps for five minutes. A cache price the gateway leaves out is the input price; null when the gateway lists no price
export async function getModelPrice(modelId: string) {
  const { models } = await gateway.getAvailableModels()
  const model = models.find((entry) => entry.id === modelId)
  if (!model) return null
  if (!model.pricing) return null

  const input = Number(model.pricing.input)

  let cacheRead = input
  if (model.pricing.cachedInputTokens) cacheRead = Number(model.pricing.cachedInputTokens)

  let cacheWrite = input
  if (model.pricing.cacheCreationInputTokens) cacheWrite = Number(model.pricing.cacheCreationInputTokens)

  const price = {
    input,
    output: Number(model.pricing.output),
    cacheRead,
    cacheWrite,
  }
  return price
}

// What a finished call through the gateway used and cost, from its reply: the generation id, the gateway's list price, and the tokens with the provider that answered. The model is the one asked for, unless the caller names it.
// A reply without a generation id never reached the gateway, so there is nothing to count
export function readGatewayCall(call: unknown, model?: string) {
  const parsed = GATEWAY_CALL.parse(call)
  const usage = parsed.usage
  const reported = parsed.providerMetadata.gateway
  if (!reported.generationId) return null

  let asked = reported.routing.originalModelId
  if (model) asked = model

  let gatewayCost = reported.cost
  if (reported.gatewayCost !== undefined) gatewayCost = reported.gatewayCost

  const tokens = {
    model: asked,
    provider: reported.routing.finalProvider,
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens,
    marketCost: String(reported.marketCost),
    gatewayCost: String(gatewayCost)
  }
  const read = {
    generationId: reported.generationId,
    marketCost: reported.marketCost,
    tokens
  }
  return read
}

function perMillion(price: string | undefined) {
  if (!price) return null
  const perToken = Number(price)
  const rounded = Number((perToken * 1_000_000).toFixed(4))
  return rounded
}
