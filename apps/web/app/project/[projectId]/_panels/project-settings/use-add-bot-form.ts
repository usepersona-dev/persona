"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useAddTelegramBot } from "@/hooks/telegram"

// The server checks the same rule, then asks Telegram who the bot is
const Schema = z.object({ token: z.string().trim().regex(/^\d+:[A-Za-z0-9_-]+$/, "That does not look like a Telegram bot token. Copy it again from BotFather.") })

type Values = z.infer<typeof Schema>

// Add a bot: the token from BotFather. Once Telegram knows the bot, it joins the list and the panel closes.
export function useAddBotForm(projectId: string, onDone: () => void) {
  const add = useAddTelegramBot(projectId)
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { token: "" } })

  async function submit(values: Values) {
    const bot = await add.trigger({ token: values.token })
    if (!bot) return

    toast.add({ title: `Added @${bot.username}`, type: "success" })
    onDone()
  }

  return { form, adding: add.isMutating, submit: form.handleSubmit(submit) }
}
