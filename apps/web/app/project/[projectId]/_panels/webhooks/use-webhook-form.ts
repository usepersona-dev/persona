"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import type { Persona } from "@/hooks/personas"
import { useCreateWebhook, useRemoveWebhook, useUpdateWebhook, type Webhook } from "@/hooks/webhooks"

// The server checks the same rules
const Schema = z.object({
  name: z.string().trim().min(1, "Give the webhook a name.").max(80, "Keep the name under 80 characters."),
  prompt: z.string().trim().min(1, "Write what to do with each call.").max(20_000, "Keep the prompt under 20,000 characters."),
})

type Values = z.infer<typeof Schema>

// The webhook panel's form: create a webhook or save one, and delete it after a confirm. Create then opens the new webhook (onCreated), so its address shows; save and delete end with onDone.
export function useWebhookForm(persona: Persona, webhook: Webhook | null, onCreated: (webhookId: string) => void, onDone: () => void) {
  const create = useCreateWebhook(persona.id)
  const update = useUpdateWebhook({ id: webhook?.id ?? "", personaId: persona.id })
  const remove = useRemoveWebhook(persona.id)
  const [confirming, setConfirming] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: webhook?.name ?? "", prompt: webhook?.prompt ?? "" } })
  const saving = create.isMutating || update.isMutating

  function submit(values: Values) {
    if (webhook) return updateWebhook(values)
    return createWebhook(values)
  }

  // The new webhook joins the list at once, so the panel can open on it before the list reloads
  async function createWebhook(values: Values) {
    const created = await create.trigger({ name: values.name, prompt: values.prompt }, { populateCache: (added: Webhook | undefined, list: Webhook[] = []) => (added ? [...list, added] : list), revalidate: true })
    if (!created) return

    toast.add({ title: `Created “${created.name}”`, type: "success" })
    onCreated(created.id)
  }

  async function updateWebhook(values: Values) {
    const saved = await update.trigger({ name: values.name, prompt: values.prompt })
    if (!saved) return

    toast.add({ title: `Saved “${saved.name}”`, type: "success" })
    onDone()
  }

  async function deleteWebhook() {
    if (!webhook) return
    await remove.trigger(webhook.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Deleted “${webhook.name}”`, type: "success" })
        onDone()
      },
    })
  }

  return { form, submit: form.handleSubmit(submit), saving, deleting: remove.isMutating, confirming, setConfirming, deleteWebhook }
}
