import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as telegram from "@/usecases/telegram"

export type TelegramBot = TelegramBots["bots"][number]
export type SharedTelegramBot = NonNullable<TelegramBots["shared"]>
export type TelegramBotInput = Parameters<typeof telegram.addTelegramBot>[2]
type TelegramBots = Output<typeof telegram.listTelegramBots>

export function useTelegramBots(projectId: string) {
  const { data, error, isLoading } = useSWR<TelegramBots, ApiError>(`/api/projects/${projectId}/telegram-bots`, fetcher)
  return { shared: data?.shared, bots: data?.bots, error, isLoading }
}

export function useAddTelegramBot(projectId: string) {
  const key = `/api/projects/${projectId}/telegram-bots`
  const add = useAction(key, (input: TelegramBotInput) => request<TelegramBot>("POST", key, input))
  return add
}

export function useRemoveTelegramBot(projectId: string) {
  const key = `/api/projects/${projectId}/telegram-bots`
  const remove = useAction(key, (botId: string) => request<void>("DELETE", `/api/telegram-bots/${botId}`))
  return remove
}
