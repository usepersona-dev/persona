import { appendFileSync, existsSync, readFileSync } from "node:fs"

import { decide } from "eve/ai"
import { defineEval, type EveEvalTurn } from "eve/evals"

import type config from "@/evals/evals.config"
import { said, waitFor } from "@/evals/shared"
import { db } from "@/prisma/db"
import { USD_PER_CREDIT } from "@/usecases/credits"
import { addInstruction } from "@/usecases/instructions"
import { updatePersona } from "@/usecases/personas"

// Real prod turns, automation runs and trigger runs replayed on each model, so models can be compared (10-29). The cases come from prod and stay out of the repo: MODEL_EVAL_CASES names their JSON file and MODEL_EVAL_OUT the JSONL file the results go to; without them the eval skips.
// Each case copies the original persona's name, instructions and notes onto the throwaway persona, runs every model in its own session (notes, automations, triggers and instructions reset in between), and Jev grades the three results blind. A run starts through its real route, as the queue's consumer calls it, so it gets the run instructions, tools and result schema as in prod

type Test = Parameters<Parameters<typeof defineEval<typeof config>>[0]["test"]>[0]
type Persona = Awaited<ReturnType<Test["context"]["makePersona"]>>
type Line = { role: string; text: string }
type Case = { kind: "chat" | "report" | "run" | "trigger"; personaId: string; history?: Line[]; message?: string; name?: string; task?: string; slug?: string; events?: unknown[] }
type Original = { name: string; instructions: { name: string; content: string }[]; notes: { title: string; content: string }[] }
type Reply = { status: string; sentToPerson: string; reactions: string[]; files: number; tools: string[]; result: unknown; closingNote: string }

const MODELS = { argon: "google/gemini-4-argon", flash: "google/gemini-3.8-flash", particle: "particle/particle-1" } as const
const REMINDER = { name: "Read this first", content: "**You talk to the person ONLY by calling chat_say. Plain text never reaches them, so every message for the person must be a chat_say call.**" }
// MODEL_EVAL_MODELS picks some of the models; MODEL_EVAL_REMINDER=off leaves Particle-1's chat_say reminder out of chats, as in prod; MODEL_EVAL_JUDGE=off skips Jev, for results graded by hand
const SELECTED = (process.env.MODEL_EVAL_MODELS ?? Object.keys(MODELS).join(",")).split(",") as (keyof typeof MODELS)[]
const CHAT_REMINDER = process.env.MODEL_EVAL_REMINDER !== "off"
const JUDGE = process.env.MODEL_EVAL_JUDGE !== "off"
const LEVELS = { fails:"Fails: nothing useful, wrong language, a false claim, or harm", poor: "Poor: little help, or clearly off", okay: "Okay: helps, with clear problems", good: "Good: helpful, natural, follows the rules", excellent: "Excellent: helpful, natural, brief, and does the right next thing" }
const POINTS = { fails: 1, poor: 2, okay: 3, good: 4, excellent: 5 } as const

const file = process.env.MODEL_EVAL_CASES
const data = file && existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { personas: Record<string, Original>; cases: Case[] }) : null

const skipped = defineEval<typeof config>({ description: "Model comparison on real turns: set MODEL_EVAL_CASES to run it.", tags: ["models"], async test(t) { t.skip("MODEL_EVAL_CASES is not set") } })
const evals = data ? data.cases.map((item, index) => defineEval<typeof config>({ description: `${item.kind}: real ${item.kind === "run" ? `automation "${item.name}"` : item.kind === "trigger" ? `trigger "${item.name}"` : "turn"} on each model`, tags: ["models"], timeoutMs: 30 * 60_000, test: (t) => compare(t, item, data.personas[item.personaId], index) })) : [skipped]

export default evals

async function compare(t: Test, item: Case, original: Original, index: number) {
  const persona = await t.context.makePersona()
  const order = [...SELECTED].sort(() => Math.random() - 0.5)
  const replies: Record<string, Reply & { ms: number; usd: number }> = {}

  for (const model of order) {
    await prepare(persona, original, model, item)
    const started = new Date()
    const reply = isRun(item) ? await runThroughRoute(t, persona.personaId, item) : replyOf(await t.send(chatMessage(item), { clientContext: earlierChat(item), headers: persona.headers }))
    const ended = new Date()
    const usd = await spend(persona.personaId, started, ended)
    replies[model] = { ...reply, ms: ended.getTime() - started.getTime(), usd }
  }

  const labels = ["A", "B", "C"].slice(0, order.length)
  const blind = Object.fromEntries(order.map((model, k) => [labels[k], replies[model]]))
  const questions = Object.fromEntries(labels.map((label) => [label, { type: "choice" as const, instructions: `Grade reply ${label} only. ${isRun(item) ? "Did the run do the task well with what it had, and is what it sent the person (or its silence) right and honest?" : "How good is it as the persona's answer to the new message?"}`, criteria: LEVELS }]))
  const judged = JUDGE ? await decide({ model: "typesafe-ai/jev", state: stateOf(item, blind), questions }) : null

  const line: Record<string, unknown> = { case: index, kind: item.kind, name: item.name, reminder: CHAT_REMINDER, at: new Date().toISOString() }
  for (const [k, model] of order.entries()) {
    const choice = judged?.answers[labels[k]]?.choice as keyof typeof POINTS | undefined
    const points = choice ? POINTS[choice] : 0
    if (judged) t.score((points - 1) / 4).label(model)
    line[model] = { ...replies[model], grade: choice ?? "none", points }
  }
  if (process.env.MODEL_EVAL_OUT) appendFileSync(process.env.MODEL_EVAL_OUT, `${JSON.stringify(line)}\n`)
}

// Particle-1 gets the chat_say reminder first in chats only (10-29), unless MODEL_EVAL_REMINDER=off
async function prepare(persona: Persona, original: Original, model: keyof typeof MODELS, item: Case) {
  const { caller, personaId } = persona
  await db.orm.public.Note.where({ personaId }).deleteAll()
  await db.orm.public.Schedule.where({ personaId }).deleteAll()
  await db.orm.public.Trigger.where({ personaId }).deleteAll()
  await db.orm.public.Instruction.where({ personaId }).deleteAll()

  const notes = original.notes.map((note) => ({ personaId, title: note.title, content: note.content }))
  if (notes.length) await db.orm.public.Note.createAll(notes)

  const first = !isRun(item) && model === "particle" && CHAT_REMINDER ? [REMINDER] : []
  const instructions = [...first, ...original.instructions]
  for (const instruction of instructions) {
    const added = await addInstruction(caller, personaId, { name: instruction.name, content: instruction.content })
    if (!added.ok) throw new Error(added.error.message)
  }

  const updated = await updatePersona(caller, personaId, { name: original.name.slice(0, 80), models: [{ model: MODELS[model], when: "Every task." }] })
  if (!updated.ok) throw new Error(updated.error.message)
}

function isRun(item: Case) {
  return item.kind === "run" || item.kind === "trigger"
}

// The run goes through its real route, called with the secret as the queue's consumer calls it; the person gets its summary when notify is true. Locally the queue hands nothing over, so the eval makes the run's rows and calls the route itself
async function runThroughRoute(t: Test, personaId: string, item: Case) {
  const run = item.kind === "trigger" ? await triggerRun(personaId, item) : await automationRun(personaId, item)
  const url = new URL(run.path, t.target.url)
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  if (response.status !== 202) throw new Error(`The run route answered ${response.status}.`)

  const ended = await waitFor(async () => {
    const found = await db.orm.public.Run.where({ id: run.id }).first()
    const done = found && found.status !== "running" ? found : undefined
    return done
  }, 6 * 60_000)
  const result = ended?.result ?? null
  const reply: Reply = { status: ended?.status ?? "failed", sentToPerson: result?.notify ? result.summary : "", reactions: [], files: 0, tools: [], result, closingNote: ended ? "" : "The run did not end within 6 minutes." }
  return reply
}

async function automationRun(personaId: string, item: Case) {
  const now = new Date()
  const later = new Date(now.getTime() + 60 * 60_000).toISOString()
  const schedule = await db.orm.public.Schedule.create({ personaId, name: item.name ?? "Eval run", prompt: item.task ?? "", at: later, enabled: false })
  const run = await db.orm.public.Run.create({ personaId, source: "automation", title: schedule.name, scheduleId: schedule.id, scheduledFor: now.toISOString() })
  return { id: run.id, path: `/eve/v1/automations/${schedule.id}/${run.id}` }
}

// The trigger's events go in as the events of its run, so the route hands them to the model as files
async function triggerRun(personaId: string, item: Case) {
  const triggerId = `ti_eval_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  await db.orm.public.Trigger.create({ id: triggerId, personaId, name: item.name ?? "Eval trigger", prompt: item.task ?? "", slug: item.slug ?? "EVAL", accountId: "eval" })
  const run = await db.orm.public.Run.create({ personaId, source: "trigger", title: item.name ?? "Eval trigger", triggerId })
  const events = (item.events ?? []).map((event, index) => ({ id: `ev_${run.id}_${index}`, triggerId, runId: run.id, data: event as never }))
  if (events.length) await db.orm.public.TriggerEvent.createAll(events)
  return { id: run.id, path: `/eve/v1/triggers/${triggerId}/${run.id}` }
}

// The message with the images it sent, by their public links, so the model sees them as it does in prod
function chatMessage(item: Case) {
  const text = item.message ?? ""
  const images = [...text.matchAll(/\[Sent (.+?) \((image\/[^)]+)\), file id [^:]+: (\S+?)\]/g)].map((match) => ({ type: "file" as const, data: match[3], mediaType: match[2], filename: match[1] }))
  if (images.length === 0) return text
  return [{ type: "text" as const, text }, ...images]
}

function earlierChat(item: Case) {
  const lines = (item.history ?? []).map((line) => `${line.role === "user" ? "Person" : "You (sent with chat_say)"}: ${line.text}`)
  if (lines.length === 0) return "This is the start of your chat with this person."
  return `Your chat with this person so far, oldest first:\n\n${lines.join("\n")}`
}

function replyOf(turn: EveEvalTurn) {
  const calls = turn.toolCalls.map((call) => ({ name: call.name, input: call.input as Record<string, unknown> }))
  const reactions = calls.filter((call) => call.name === "chat_react").map((call) => String(call.input.emoji ?? ""))
  const files = calls.filter((call) => call.name === "chat_file").length
  const tools = calls.filter((call) => !call.name.startsWith("chat_")).map((call) => call.name)
  const reply: Reply = { status: turn.status, sentToPerson: said(turn), reactions, files, tools, result: turn.data ?? null, closingNote: turn.reply ?? "" }
  return reply
}

// What the throwaway persona's model calls cost between these times, at list price, as the usage hook recorded them
async function spend(personaId: string, from: Date, to: Date) {
  await new Promise((resolve) => setTimeout(resolve, 8000))
  const rows = await db.orm.public.Usage.where({ personaId }).where((usage) => usage.at.gte(from.toISOString())).where((usage) => usage.at.lte(new Date(to.getTime() + 8000).toISOString())).all()
  const credits = rows.reduce((sum, row) => sum + Number(row.credits), 0)
  const usd = credits * USD_PER_CREDIT
  return usd
}

function stateOf(item: Case, blind: Record<string, Reply>) {
  const replies = Object.fromEntries(Object.entries(blind).map(([label, reply]) => [label, { sentToPerson: reply.sentToPerson.slice(0, 1500), reactions: reply.reactions, files: reply.files, toolsUsed: reply.tools, result: reply.result ? JSON.stringify(reply.result).slice(0, 1500) : "", failed: reply.status === "failed" }]))
  const run = "An assistant persona ran one of its automations on its own. Its result's summary, passed on when notify is true (sentToPerson), is the message the person gets; when there's nothing new for them, notify should be false and nothing goes out. It must do the task with its notes and tools. This test copy has the original instructions and notes but no connected apps (email, calendar), so saying honestly what is missing is correct."
  const chat = "An assistant persona in a WhatsApp chat answered a real message. The person sees only chat_say messages, emoji reactions and files; nothing else reaches them. Before sending, booking, paying or changing details it must ask first, and it must never claim it did something it did not do. This test copy has the original instructions and notes but no connected apps (email, calendar), so saying honestly that it can't reach them, or asking to connect, is fine."
  const earlierChat = (item.history ?? []).map((line) => `${line.role === "user" ? "Person" : "Persona"}: ${line.text}`).join("\n").slice(-3000)
  const events = JSON.stringify(item.events ?? []).slice(0, 4000)
  const state = { setting: isRun(item) ? run : chat, kind: item.kind, automation: item.name ?? "", task: (item.task ?? "").slice(0, 2500), events, earlierChat, newMessage: (item.message ?? "").slice(0, 1500), replies }
  return state
}
