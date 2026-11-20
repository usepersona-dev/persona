"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useCreateAutomation, useRemoveAutomation, useUpdateAutomation, type Automation, type Suggestion } from "@/hooks/automations"
import type { Persona } from "@/hooks/personas"

import { planOf, scheduleOf, type Plan } from "./schedule"

// The server checks the same rules, and a custom cron's own shape
const Schema = z.object({
  name: z.string().trim().min(1, "Give the automation a name.").max(80, "Keep the name under 80 characters."),
  plan: z
    .custom<Plan>()
    .refine((plan) => plan.freq !== "weekly" || plan.days.length > 0, "Pick at least one day.")
    .refine((plan) => plan.freq !== "once" || Date.parse(plan.at) > Date.now(), "Pick a time in the future.")
    .refine((plan) => plan.freq !== "custom" || plan.cron.trim().length > 0, "Write the schedule, like 0 9 * * 1 for Mondays at 9."),
  prompt: z.string().trim().min(1, "Write what to do.").max(20_000, "Keep it under 20,000 characters."),
})

type Values = z.infer<typeof Schema>

// The automation panel's form: create a new automation (blank, or filled in from a suggestion) or save one, and delete it after a confirm. onDone runs after each of them.
// Times are in the automation's own timezone, or this browser's for a new one.
export function useAutomationForm(persona: Persona, automation: Automation | null, suggestion: Suggestion | null, onDone: () => void) {
  const create = useCreateAutomation(persona.id)
  const update = useUpdateAutomation({ id: automation?.id ?? "", personaId: persona.id })
  const remove = useRemoveAutomation(persona.id)
  const [confirming, setConfirming] = useState(false)
  const timezone = automation?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: automation?.name ?? suggestion?.name ?? "", plan: planOf(automation ?? { cron: suggestion?.cron ?? null, at: null }), prompt: automation?.prompt ?? suggestion?.prompt ?? "" } })
  const saving = create.isMutating || update.isMutating

  function submit(values: Values) {
    if (automation) return updateAutomation(values)
    return createAutomation(values)
  }

  async function createAutomation(values: Values) {
    const created = await create.trigger({ name: values.name, prompt: values.prompt, timezone, ...scheduleOf(values.plan) })
    if (!created) return

    toast.add({ title: `Created “${created.name}”`, type: "success" })
    onDone()
  }

  async function updateAutomation(values: Values) {
    const saved = await update.trigger({ name: values.name, prompt: values.prompt, timezone, ...scheduleOf(values.plan) })
    if (!saved) return

    toast.add({ title: `Saved “${saved.name}”`, type: "success" })
    onDone()
  }

  async function deleteAutomation() {
    if (!automation) return
    await remove.trigger(automation.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Deleted “${automation.name}”`, type: "success" })
        onDone()
      },
    })
  }

  return { form, submit: form.handleSubmit(submit), saving, deleting: remove.isMutating, confirming, setConfirming, deleteAutomation, timezone }
}
