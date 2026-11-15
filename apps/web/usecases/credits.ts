import { z } from "zod"

import type { Sandbox } from "@vercel/sandbox"

import { readGatewayCall } from "@/lib/ai-gateway"
import * as autumn from "@/lib/autumn"
import type { getRun } from "@/lib/browser-use"
import { err, ok, validate } from "@/lib/errors"
import type { BrowserUsageInput, SandboxUsageInput, TokenUsageInput } from "@/prisma/contract.d"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"

export const USD_PER_CREDIT = 0.2
const VIDEO_CREDITS = 6
const CPU_USD_PER_HOUR = 0.128
const MEMORY_USD_PER_GB_HOUR = 0.0212


const spanInput = z.object({
  from: z.iso.datetime({ message: "Give the start as an ISO time." }),
  to: z.iso.datetime({ message: "Give the end as an ISO time." }),
  unit: z.enum(["hour", "day"], { message: "Count by hour or by day." }),
  timeZone: z.string().min(1, "Give a time zone."),
}).refine((span) => span.from < span.to, "The end comes before the start.")

type UsageInput = {
  id: string;
  personaId: string;
  sessionId: string | null;
  credits: number;
  usage: {
    tokens?: TokenUsageInput;
    browser?: BrowserUsageInput;
    sandbox?: SandboxUsageInput
  }
}

type SpanQuery = {
  from: string;
  to: string;
  unit: string;
  timeZone: string
}

// One model call through the gateway: the gateway's list price in credits and the tokens, under the generation id. A reply that never reached the gateway counts nothing
export async function chargeGatewayCall(personaId: string, sessionId: string | null, call: Parameters<typeof readGatewayCall>[0], model?: string) {
  const read = readGatewayCall(call, model)
  if (!read) return ok(0)

  const charged = await chargeUsage({
    id: read.generationId,
    personaId, sessionId,
    credits: read.marketCost / USD_PER_CREDIT,
    usage: { tokens: read.tokens }
  })
  return charged
}

// One finished video clip: the gateway's reply names the generation but carries no price, so a clip costs a fixed 6 credits, $1.20 in the gateway's records
export async function chargeVideoClip(personaId: string, model: string, generationId: string) {
  const tokens = { model, provider: null, inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0, marketCost: null, gatewayCost: null }
  const charged = await chargeUsage({
    id: generationId,
    personaId,
    sessionId: null,
    credits: VIDEO_CREDITS,
    usage: { tokens }
  })
  return charged
}

// One finished browser task: Browser Use's price for its AI and web search, in credits. The browser's time and proxy are billed on the browser and are not saved
export async function chargeBrowserRun(personaId: string, sessionId: string | null, browserId: string, run: Awaited<ReturnType<typeof getRun>>) {
  const browser = { browserId, model: run.model, inputTokens: run.totalInputTokens, outputTokens: run.totalOutputTokens, marketCost: run.totalCostUsd }
  const charged = await chargeUsage({
    id: run.id,
    personaId,
    sessionId,
    credits: Number(run.totalCostUsd) / USD_PER_CREDIT,
    usage: { browser }
  })
  return charged
}

// Sandbox time since the session's sandbox was last counted, at Vercel's list prices (vercel.com/docs/sandbox/pricing, 2026-09-10): active CPU by the hour, memory by the GB-hour in whole minutes.
// Vercel keeps running totals, so the row keeps them too, and the growth over the session's latest sandbox row is what this count charges. The id is the sandbox's name and total, so a repeat save is nothing
export async function chargeSandbox(personaId: string, sessionId: string, sandbox: Sandbox) {
  const now = {
    sandboxId: sandbox.name, memoryMb: sandbox.memory ?? 2048,
    totalRunMs: sandbox.totalDurationMs ?? 0,
    totalCpuMs: sandbox.totalActiveCpuDurationMs ?? 0
  }

  const latest = await db.orm.public.Usage
    .where({ sessionId })
    .where((usage) => usage.sandbox.isNotNull())
    .orderBy((usage) => usage.at.desc())
    .select("sandbox")
    .first()

  let counted = { totalRunMs: 0, totalCpuMs: 0 }
  if (latest?.sandbox?.sandboxId === now.sandboxId) { counted = latest.sandbox }

  const runMs = now.totalRunMs - counted.totalRunMs
  const cpuMs = now.totalCpuMs - counted.totalCpuMs
  if (runMs <= 0) return ok(0)

  const cpuHours = cpuMs / 3_600_000
  const memoryGbHours = (Math.ceil(runMs / 60_000) / 60) * (now.memoryMb / 1024)
  const marketCost = cpuHours * CPU_USD_PER_HOUR + memoryGbHours * MEMORY_USD_PER_GB_HOUR

  const charged = await chargeUsage({
    id: `${now.sandboxId}:${now.totalRunMs}`,
    personaId, sessionId,
    credits: marketCost / USD_PER_CREDIT,
    usage: { sandbox: { ...now, runMs, cpuMs, marketCost: String(marketCost) } }
  })

  return charged
}

// Saves one thing an organization used: its price in credits and what it was, under its kind (tokens for an AI call, browser for a browser task, sandbox for sandbox time), then takes the credits from its balance on Autumn. A repeated id saves and takes nothing.
// The saved row is the record, so a refusal from Autumn is logged and the usage still counts as saved
export async function chargeUsage(input: UsageInput) {
  const persona = await db.orm.public.Persona.where({ id: input.personaId }).select("orgId", "projectId").first()
  if (!persona) return err("not_found", "This persona does not exist.")

  const row = {
    id: input.id,
    orgId: persona.orgId,
    projectId: persona.projectId,
    personaId: input.personaId,
    sessionId: input.sessionId,
    credits: String(input.credits),
    ...input.usage
  }
  const saved = await db.orm.public.Usage.createAndCount([row], { onConflict: "skip", conflictOn: ["id"] })
  if (saved === 0) return ok(saved)

  const taken = await autumn.trackCredits(persona.orgId, input.personaId, input.credits)
  if (!taken.ok) console.error("Autumn did not take the credits.", persona.orgId, input.id, taken.error)
  return ok(saved)
}

// Whether the organization may start a turn: it has any credits left, or no limit. Its first turn makes its Autumn customer, which starts with the Free plan's credits
export async function hasCredits(caller: Caller) {
  const checked = await autumn.checkCredits(caller.orgId)
  if (checked.ok || checked.error.code !== "not_found") return checked

  const customer = await autumn.readCustomer(caller.orgId)
  if (!customer.ok) return customer
  return ok(true)
}

export async function listUsage(caller: Caller, input: SpanQuery) {
  const parsed = validate(spanInput, input)
  if (!parsed.ok) return parsed
  const span = parsed.value

  const query = db.raw.sql`
    SELECT persona_id AS "personaId", project_id AS "projectId", date_trunc(${span.unit}, at, ${span.timeZone}) AS "start",
      sum(credits) AS credits, count(*)::int AS charges, sum((tokens->>'inputTokens')::int + (tokens->>'outputTokens')::int)::int AS tokens
    FROM usage
    WHERE org_id = ${caller.orgId} AND at >= ${span.from} AND at < ${span.to}
    GROUP BY persona_id, project_id, "start"
  `.returnsRow({
    personaId: "pg/text@1",
    projectId: "pg/text@1",
    start: "pg/timestamptz-string@1",
    credits: "pg/numeric@1",
    charges: "pg/int4@1",
    tokens: "pg/int4@1"
  }).build()

  const rows = await db.query(query)
  const personas = await db.orm.public.Persona.where({ orgId: caller.orgId }).select("id", "name", "imageUrl", "projectId").all()

  const buckets = rows.map((row) => ({ ...row, credits: Number(row.credits) }))
  const usage = { personas, buckets }
  return ok(usage)
}
