import { handler, readJson } from "@/app/api/handler"
import { addTelegramBot, listTelegramBots } from "@/usecases/telegram"

type Params = { projectId: string }

export const GET = handler<Params>(async (caller, { projectId }) => {
  const telegram = await listTelegramBots(caller, projectId)
  return telegram
})

export const POST = handler<Params>(async (caller, { projectId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const bot = await addTelegramBot(caller, projectId, input.value)
  return bot
})
