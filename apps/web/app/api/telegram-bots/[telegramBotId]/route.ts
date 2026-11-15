import { handler } from "@/app/api/handler"
import { removeTelegramBot } from "@/usecases/telegram"

type Params = { telegramBotId: string }

export const DELETE = handler<Params>(async (caller, { telegramBotId }) => {
  const removed = await removeTelegramBot(caller, telegramBotId)
  return removed
})
