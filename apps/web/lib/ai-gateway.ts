import { gateway } from "ai"
import { z } from "zod"

export type GatewayModel = {
  id: string
  name: string
  provider: string
  input: number | null
  output: number | null
  context: number | null
  released: number | null
  usage: number | null
  tags: string[]
  regions: string[]
}

const CATALOGUE_URL = "https://ai-gateway.vercel.sh/v1/models"
const LEADERBOARD_URL = "https://vercel.com/api/ai/leaderboard-export?dataset=models&modality=text"
const LEADERBOARD = z.object({
  rows: z.array(
    z.object({
      date: z.string(),
      name: z.string(),
      metric: z.string(),
      share_percent: z.number(),
    })
  ),
})
const CATALOGUE = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      owned_by: z.string(),
      context_window: z.number().nullish(),
      released: z.number().nullish(),
      tags: z.array(z.string()).nullish(),
      regions: z.array(z.string()).nullish(),
      modalities: z.object({
        input: z.array(z.string()),
        output: z.array(z.string()),
      }),
      pricing: z
        .object({ input: z.string().optional(), output: z.string().optional() })
        .nullish(),
    })
  ),
})

type GatewayCall = {
  usage?: { inputTokens?: number; outputTokens?: number; inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }; outputTokenDetails?: { reasoningTokens?: number } };
  providerMetadata?: Readonly<Record<string, unknown>>
}

const GATEWAY = z.object({
  marketCost: z.coerce.number().catch(0),
  cost: z.coerce.number().catch(0),
  gatewayCost: z.coerce.number().optional().catch(undefined),
  generationId: z.string().optional(),
  routing: z.object({ originalModelId: z.string().optional(), finalProvider: z.string().optional() }).optional()
})

// What one call through the gateway used and cost, read from the reply's provider metadata: the generation id, the gateway's list price, and the tokens with the provider that answered. The model is the one asked for, unless the caller names it.
// A reply without a generation id never reached the gateway, so there is nothing to count
export function readGatewayCall(call: GatewayCall, model?: string) {
  const gateway = GATEWAY.parse(call.providerMetadata?.gateway ?? {})
  if (!gateway.generationId) return null

  const tokens = {
    model: model ?? gateway.routing?.originalModelId ?? "unknown",
    provider: gateway.routing?.finalProvider ?? null,
    inputTokens: call.usage?.inputTokens ?? 0,
    cachedInputTokens: call.usage?.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: call.usage?.inputTokenDetails?.cacheWriteTokens ?? 0,
    outputTokens: call.usage?.outputTokens ?? 0,
    reasoningTokens: call.usage?.outputTokenDetails?.reasoningTokens ?? 0,
    marketCost: String(gateway.marketCost),
    gatewayCost: String(gateway.gatewayCost ?? gateway.cost)
  }
  return { generationId: gateway.generationId, marketCost: gateway.marketCost, tokens }
}

// The gateway's record of one generation, in the shape its replies carry as provider metadata. A video clip's price is only in this record. On our own provider key the provider's charge is the upstream cost, and the gateway's own bill is the total cost
export async function getGenerationMetadata(id: string) {
  const record = await gateway.getGenerationInfo({ id })
  let price = record.totalCost
  if (record.isByok) price = record.upstreamInferenceCost

  const metadata = {
    generationId: record.id,
    marketCost: String(price),
    cost: String(record.totalCost),
    gatewayCost: String(record.totalCost),
    routing: { finalProvider: record.providerName }
  }

  return metadata
}

export async function listModels(): Promise<GatewayModel[]> {
  const headers = new Headers()
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`)

  const [response, usage] = await Promise.all([fetch(CATALOGUE_URL, { headers }), getUsage(),])
  if (!response.ok) throw new Error(`The gateway model catalogue answered ${response.status}. Set AI_GATEWAY_API_KEY if it now asks for a key.`)

  const catalogue = CATALOGUE.safeParse(await response.json())
  if (!catalogue.success) throw new Error("The gateway model catalogue came back in a shape this agent does not understand.")

  const language = catalogue.data.data.filter(
    (model) =>
      model.type === "language" &&
      model.modalities.input.includes("text") &&
      model.modalities.output.includes("text")
  )

  return language
    .map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.owned_by,
      input: perMillion(model.pricing?.input),
      output: perMillion(model.pricing?.output),
      context: model.context_window ?? null,
      released: model.released ?? null,
      usage: usage.get(model.name) ?? null,
      tags: model.tags ?? [],
      regions: model.regions ?? [],
    }))
    .sort((first, second) => first.id.localeCompare(second.id))
}

async function getUsage(): Promise<Map<string, number>> {
  const from = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
  const response = await fetch(`${LEADERBOARD_URL}&from=${from}`)
  if (!response.ok) throw new Error(`The gateway leaderboard answered ${response.status}.`)

  const board = LEADERBOARD.safeParse(await response.json())
  if (!board.success) throw new Error("The gateway leaderboard came back in a shape this agent does not understand.")

  const latest = board.data.rows.reduce((day, row) => (row.date > day ? row.date : day), "")
  return new Map(
    board.data.rows
      .filter((row) => row.date === latest && row.metric === "requests")
      .map((row) => [row.name, row.share_percent])
  )
}

function perMillion(price: string | undefined) {
  if (!price) return null
  return Number((Number(price) * 1_000_000).toFixed(4))
}
