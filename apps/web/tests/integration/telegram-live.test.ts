import assert from "node:assert/strict"
import { setTimeout as sleep } from "node:timers/promises"
import { afterAll, test } from "vitest"

import { db } from "@/prisma/db"
import { createAgentToken } from "@/usecases/agent"
import { readTelegramToken } from "@/usecases/telegram"

// Live, and only when asked: one real turn through a running dev server and a real Telegram bot, counting what the chat really got.
// Telegram numbers a bot's messages in its private chats in one sequence, so a silent message before and after the turn, each deleted at once, brackets what went out.
// Set TEST_TELEGRAM_BOT_ID and TEST_TELEGRAM_CHAT_ID to a test bot and a chat linked to a persona, with the dev server on TEST_APP_URL (http://localhost:3000 by default). Nobody else may write to that bot during the run.

type ToolCallEvent = { type: string; meta?: { at?: string }; scope?: { turnId?: string }; data?: { turnId?: string; outcome?: string; capability?: { kind: string; name: string } } }

const BOT_ID = process.env.TEST_TELEGRAM_BOT_ID ?? ""
const CHAT_ID = process.env.TEST_TELEGRAM_CHAT_ID ?? ""
const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:3000"

afterAll(async () => {
  await db.close()
})

test("a real turn reaches the Telegram chat only through the chat tools: one message for each chat_say and chat_file", { skip: !BOT_ID || !CHAT_ID }, async () => {
  const link = await db.orm.public.Link.include("persona").where({ channel: "telegram", line: BOT_ID, externalId: CHAT_ID }).first()
  assert.ok(link, "the chat is linked to a persona")
  const botToken = await readTelegramToken(BOT_ID)
  assert.ok(botToken.ok, "the bot's token is stored")
  const agentToken = await createAgentToken({ orgId: link.persona.orgId, userId: "live-test" }, link.personaId)
  assert.ok(agentToken.ok)
  const address = `telegram:telegram:${BOT_ID}:${CHAT_ID}:${link.personaId}`

  async function telegram(method: string, body: object) {
    const response = await fetch(`https://api.telegram.org/bot${botToken.ok ? botToken.value : ""}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const answer = (await response.json()) as { ok: boolean; result?: { message_id: number }; description?: string }
    if (!answer.ok) throw new Error(`Telegram ${method}: ${answer.description}`)
    return answer.result
  }

  async function probe() {
    const sent = await telegram("sendMessage", { chat_id: Number(CHAT_ID), text: "·", disable_notification: true })
    await telegram("deleteMessage", { chat_id: Number(CHAT_ID), message_id: sent?.message_id })
    return sent?.message_id ?? 0
  }

  async function eventsOf(sessionId: string) {
    const response = await fetch(`${APP_URL}/eve/v1/session/${sessionId}/stream?follow=false&startIndex=0`, { headers: { authorization: `Bearer ${agentToken.ok ? agentToken.value.token : ""}` } })
    const lines = (await response.text()).split("\n").filter((line) => line.trim())
    return lines.map((line) => JSON.parse(line) as ToolCallEvent)
  }

  const opening = await probe()
  const startedAt = new Date().toISOString()
  const now = Math.floor(Date.now() / 1000)
  const update = { update_id: now, message: { message_id: now % 1_000_000, from: { id: Number(CHAT_ID), is_bot: false, first_name: "Live test" }, chat: { id: Number(CHAT_ID), type: "private" }, date: now, text: "Live test: tell me two short facts about Jupiter, one message each." } }
  const webhook = await fetch(`${APP_URL}/eve/v1/telegram/${BOT_ID}`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET ?? "" }, body: JSON.stringify(update) })
  assert.equal(webhook.status, 200)

  let turn: ToolCallEvent[] = []
  for (let attempt = 0; attempt < 60 && turn.length === 0; attempt += 1) {
    await sleep(3000)
    const session = await db.orm.public.Session.where({ address }).orderBy((row) => row.createdAt.desc()).first()
    if (!session) continue
    const events = await eventsOf(session.id)
    const ended = events.find((event) => event.type === "turn.settled" && (event.meta?.at ?? "") > startedAt)
    if (ended) turn = events.filter((event) => (event.scope?.turnId ?? event.data?.turnId) === ended.data?.turnId)
  }
  assert.ok(turn.length > 0, "the turn ended within three minutes")
  assert.ok(!turn.some((event) => event.type === "turn.settled" && event.data?.outcome === "failed"), "the turn did not fail")

  const closing = await probe()
  const calls = turn.flatMap((event) => (event.type === "call.requested" ? [event.data?.capability?.name ?? ""] : []))
  const sent = calls.filter((name) => name === "chat_say" || name === "chat_file").length
  assert.ok(sent >= 2, "the persona sent its answer with the chat tools")
  assert.equal(closing - opening - 1, sent, "the chat got exactly the chat tools' messages, and nothing else")
})
