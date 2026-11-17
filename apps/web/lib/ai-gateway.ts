import { getCache } from "@vercel/functions"
import { z } from "zod"

const CATALOGUE_URL = "https://ai-gateway.vercel.sh/v1/models"
const CATALOGUE_SECONDS = 24 * 60 * 60

const PRICE = z.coerce.number().optional().catch(undefined)

const MODELS = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    owned_by: z.string(),
    context_window: z.number().nullable().catch(null),
    released: z.number().nullable().catch(null),
    tags: z.array(z.string()).catch([]),
    pricing: z.object({
      input: PRICE,
      output: PRICE,
      input_cache_read: PRICE,
      input_cache_write: PRICE,
      image: PRICE,
      image_dimension_quality_pricing: z.array(z.object({ size: z.string().optional(), quality: z.string().optional(), cost: z.coerce.number() })).catch([]),
      speech_input_character_cost: PRICE,
      transcription_duration_cost_per_second: PRICE,
      video_duration_pricing: z.array(z.object({ resolution: z.string(), audio: z.boolean().optional(), cost_per_second: z.coerce.number() })).catch([]),
    }).catch({ image_dimension_quality_pricing: [], video_duration_pricing: [] }),
  })
)

const CATALOGUE = z.object({ data: MODELS })

export type GatewayModel = Awaited<ReturnType<typeof listLanguageModels>>[number]

// The language models a persona can run on, sorted by id
export async function listLanguageModels() {
  const catalogue = await readCatalogue()
  const language = catalogue.filter((model) => model.type === "language")
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

// A model's prices per token: input, output, and cache reads and writes, which cost the input price when the gateway lists none. null when the gateway does not list the model
export async function getTextModelPrice(modelId: string) {
  const model = await findModel(modelId)
  if (!model) return null

  const input = model.pricing.input ?? 0
  const price = {
    input,
    output: model.pricing.output ?? 0,
    cacheRead: model.pricing.input_cache_read ?? input,
    cacheWrite: model.pricing.input_cache_write ?? input,
  }
  return price
}

// One image's price at a size, such as "1K" or "default", or the model's flat price for every image. null when the gateway lists no per-image price for the model, such as one priced by tokens, or does not list the model
export async function getImageModelPrice(modelId: string, size = "default") {
  const model = await findModel(modelId)
  if (!model) return null

  const sized = model.pricing.image_dimension_quality_pricing.find((entry) => entry.size === size)
  const price = sized?.cost ?? model.pricing.image ?? null
  return price
}

// A speech model's price per character of the text it reads out; 0 for a model priced another way, such as Gemini's by audio token. null when the gateway does not list the model
export async function getSpeechModelPrice(modelId: string) {
  const model = await findModel(modelId)
  if (!model) return null

  const price = model.pricing.speech_input_character_cost ?? 0
  return price
}

// A transcription model's price per second of audio; 0 for a model priced another way, by audio token. null when the gateway does not list the model
export async function getTranscriptionModelPrice(modelId: string) {
  const model = await findModel(modelId)
  if (!model) return null

  const price = model.pricing.transcription_duration_cost_per_second ?? 0
  return price
}

// A video model's price per second at a resolution, such as "720p", with or without sound; null when the gateway lists none for it
export async function getVideoModelPrice(modelId: string, resolution: string, audio: boolean) {
  const model = await findModel(modelId)
  if (!model) return null

  const tier = model.pricing.video_duration_pricing.find((entry) => entry.resolution === resolution && (entry.audio === undefined || entry.audio === audio))
  if (!tier) return null
  return tier.cost_per_second
}

async function findModel(modelId: string) {
  const catalogue = await readCatalogue()
  const model = catalogue.find((entry) => entry.id === modelId)
  return model ?? null
}

// The gateway's model list with its prices, fetched at most once a day: Vercel's runtime cache keeps it between calls
async function readCatalogue() {
  const cache = getCache({ namespace: "ai-gateway" })
  const cached = await cache.get("catalogue")
  if (cached !== null) return MODELS.parse(cached)

  const response = await fetch(CATALOGUE_URL)
  if (!response.ok) throw new Error(`The gateway model catalogue answered ${response.status}.`)

  const body = await response.json()
  const catalogue = CATALOGUE.safeParse(body)
  if (!catalogue.success) throw new Error("The gateway model catalogue came back in a shape this agent does not understand.")

  await cache.set("catalogue", catalogue.data.data, { ttl: CATALOGUE_SECONDS })
  return catalogue.data.data
}

function perMillion(price: number | undefined) {
  if (price === undefined) return null
  const rounded = Number((price * 1_000_000).toFixed(4))
  return rounded
}
