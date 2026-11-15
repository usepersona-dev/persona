"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { formatDistanceToNowStrict } from "date-fns"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import type { Persona } from "@/hooks/personas"
import { useAddCredential, useCreateCollectLink, useRemoveCredential, useSetCredentialValues, useUpdateCredential, type VaultCredential } from "@/hooks/vault"

import type { StartField } from "./presets"

// A saved value never comes back: `filled` says one is saved, and an empty value keeps it
const Field = z.object({ name: z.string().trim(), secret: z.boolean(), value: z.string().max(4000, "Keep each value under 4000 characters."), filled: z.boolean() })

// The server checks the same rules
const Schema = z.object({
  title: z.string().trim().min(1, "Give the credential a title.").max(120, "Keep the title under 120 characters."),
  fields: z
    .array(Field)
    .min(1, "Add at least one field.")
    .max(30, "A credential can have up to 30 fields.")
    .refine((fields) => fields.every((field) => field.name), "Name every field.")
    .refine((fields) => new Set(fields.map((field) => field.name)).size === fields.length, "Give every field a different name."),
  description: z.string().trim().max(1000, "Keep the description under 1000 characters."),
})

type Values = z.infer<typeof Schema>
export type CredentialField = z.infer<typeof Field>

// The credential panel's form: create a new credential (with the fields it starts with) or save one, then the values typed, and delete it after a confirm. onDone runs after each of them.
// A saved credential can also give a link (/collect/<token>) where anyone who has it fills in the values, for a day.
export function useCredentialForm(persona: Persona, credential: VaultCredential | null, start: StartField[], onDone: () => void) {
  const add = useAddCredential(persona.id)
  const update = useUpdateCredential({ id: credential?.id ?? "", personaId: persona.id })
  const setValues = useSetCredentialValues(persona.id)
  const remove = useRemoveCredential(persona.id)
  const link = useCreateCollectLink(credential?.id ?? "")
  const [confirming, setConfirming] = useState(false)
  const fields = credential ? credential.fields.map((field) => ({ ...field, value: "", filled: credential.filled.includes(field.name) })) : start.map((field) => ({ ...field, value: "", filled: false }))
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { title: credential?.title ?? "", fields, description: credential?.description ?? "" } })
  const saving = add.isMutating || update.isMutating || setValues.isMutating

  function submit(values: Values) {
    if (credential) return updateCredential(values)
    return addCredential(values)
  }

  async function addCredential(values: Values) {
    const added = await add.trigger({ title: values.title, description: values.description, fields: values.fields.map(({ name, secret }) => ({ name, secret })) })
    if (!added) return
    const saved = await saveValues(added.id, values.fields)
    if (!saved) return

    toast.add({ title: `Created “${added.title}”`, type: "success" })
    onDone()
  }

  async function updateCredential(values: Values) {
    const updated = await update.trigger({ title: values.title, description: values.description, fields: values.fields.map(({ name, secret }) => ({ name, secret })) })
    if (!updated) return
    const saved = await saveValues(updated.id, values.fields)
    if (!saved) return

    toast.add({ title: `Saved “${updated.title}”`, type: "success" })
    onDone()
  }

  // Only the values typed go out; the server drops the values of fields taken out
  async function saveValues(id: string, fields: CredentialField[]) {
    const typed = fields.filter((field) => field.value)
    if (typed.length === 0) return true

    const values = Object.fromEntries(typed.map((field) => [field.name, field.value]))
    const filled = await setValues.trigger({ id, values })
    return !!filled
  }

  async function deleteCredential() {
    if (!credential) return
    await remove.trigger(credential.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Deleted “${credential.title}”`, type: "success" })
        onDone()
      },
    })
  }

  async function copyLink() {
    const created = await link.trigger()
    if (!created) return
    await navigator.clipboard.writeText(created.url)

    toast.add({ title: "Link copied", description: `Anyone with the link can fill in the values. It stops working in ${formatDistanceToNowStrict(new Date(created.expiresAt))}.`, type: "success" })
  }

  return { form, submit: form.handleSubmit(submit), saving, deleting: remove.isMutating, confirming, setConfirming, deleteCredential, copyLink, copying: link.isMutating }
}
