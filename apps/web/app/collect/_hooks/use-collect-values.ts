"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { useSubmitCollectForm, type CollectForm } from "@/hooks/vault"

// One value per field, by position, since a field's name may hold a dot. The server checks the same rule.
const Schema = z.object({ values: z.array(z.string().max(4000, "Keep each value under 4000 characters.")) })

type Values = z.infer<typeof Schema>

// The collect page's form: Save sends only the values typed, so an empty field keeps what is saved. onSaved runs after a save.
export function useCollectValues(token: string, ask: CollectForm, onSaved: () => void) {
  const submit = useSubmitCollectForm(token)
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { values: ask.fields.map(() => "") } })
  const values = useWatch({ control: form.control, name: "values" })
  const typed = values.some((value) => value !== "")

  async function save(values: Values) {
    const entries = ask.fields.map((field, index) => [field.name, values.values[index]] as const)
    const typedEntries = entries.filter(([, value]) => value !== "")
    const saved = await submit.trigger(Object.fromEntries(typedEntries))
    if (!saved) return

    onSaved()
  }

  return { form, save: form.handleSubmit(save), saving: submit.isMutating, typed }
}
