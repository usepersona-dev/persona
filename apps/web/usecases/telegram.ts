import { z } from "zod"

import { err, ok, validate } from "@/lib/errors"
import { deleteWebhook, getMe, setWebhook } from "@/lib/telegram"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getProject } from "@/usecases/projects"
import { readSecret, removeSecrets, writeSecret } from "@/usecases/secrets"

const botInput = z.object({ token: z.string().trim().regex(/^\d+:[A-Za-z0-9_-]+$/, "That does not look like a Telegram bot token. Copy it again from BotFather.") })

export async function listTelegramBots(caller: Caller, projectId: string) {
  const project = await getProject(caller, projectId)
  if (!project.ok) return project

  const bots = await db.orm.public.TelegramBot.where({ projectId }).orderBy((bot) => bot.createdAt.asc()).all()
  const shared = sharedTelegramBot()
  return ok({ shared, bots })
}

export async function addTelegramBot(caller: Caller, projectId: string, input: z.input<typeof botInput>) {
  const parsed = validate(botInput, input)
  if (!parsed.ok) return parsed
  const { token } = parsed.value

  const project = await getProject(caller, projectId)
  if (!project.ok) return project

  const profile = await checkBotToken(token)
  if (!profile.ok) return profile
  const botId = String(profile.value.id)

  const shared = sharedTelegramBot()
  if (shared && shared.botId === botId) return err("conflict", "That is Persona's shared bot. Add a bot of your own.")

  const existing = await db.orm.public.TelegramBot.where({ botId }).first()
  if (existing) return err("conflict", `@${profile.value.username} is already added.`)

  await setWebhook(token, new URL(`/eve/v1/telegram/${botId}`, process.env.APP_URL!).href, process.env.TELEGRAM_WEBHOOK_SECRET!)
  const bot = await db.orm.public.TelegramBot.create({ projectId, botId, username: profile.value.username, name: profile.value.name })
  await writeSecret(bot.id, [{ name: "token", value: token }])
  return ok(bot)
}

export async function removeTelegramBot(caller: Caller, telegramBotId: string) {
  const bot = await findTelegramBot(caller, telegramBotId)
  if (!bot.ok) return bot

  const secret = await readSecret(bot.value.id)
  const token = secret.find((value) => value.name === "token")
  if (token) await deleteWebhook(token.value).catch(() => undefined)

  await db.orm.public.Link.where({ channel: "telegram", line: bot.value.botId }).deleteAll()
  await db.orm.public.TelegramBot.where({ id: bot.value.id }).delete()
  await removeSecrets([bot.value.id])
  return ok(undefined)
}

export async function readTelegramToken(botId: string) {
  const shared = process.env.TELEGRAM_BOT_TOKEN
  if (shared && shared.startsWith(`${botId}:`)) return ok(shared)

  const bot = await db.orm.public.TelegramBot.where({ botId }).first()
  if (!bot) return err("not_found", "This bot is not connected to Persona.")

  const secret = await readSecret(bot.id)
  const token = secret.find((value) => value.name === "token")
  if (!token) return err("not_found", "This bot has no token.")

  return ok(token.value)
}

export function sharedTelegramBot() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return null

  const bot = { botId: botToken.split(":")[0], username: process.env.TELEGRAM_BOT_USERNAME ?? "", name: process.env.TELEGRAM_BOT_NAME ?? "" }
  return bot
}

async function checkBotToken(token: string) {
  try {
    const profile = await getMe(token)
    return ok(profile)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("no username")) return err("invalid", message)
    if (message.includes("answered 401") || message.includes("answered 404")) return err("invalid", "Telegram did not accept that token. Copy it again from BotFather.")
    throw error
  }
}

async function findTelegramBot(caller: Caller, telegramBotId: string) {
  const bot = await db.orm.public.TelegramBot.where({ id: telegramBotId }).first()
  if (!bot) return err("not_found", "This bot does not exist.")

  const project = await db.orm.public.Project.where({ id: bot.projectId, orgId: caller.orgId }).first()
  if (!project) return err("not_found", "This bot does not exist.")

  return ok(bot)
}
