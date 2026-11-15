"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useAddConnection, useCheckConnection, useRemoveConnection, useUpdateConnection, type Connection, type ConnectionCheck } from "@/hooks/connections"
import type { Persona } from "@/hooks/personas"

// A saved header comes back without its value: an empty value keeps the saved one
const Header = z.object({ name: z.string(), value: z.string(), saved: z.boolean() })

// The server checks the same rules, and that the name is free
const Schema = z.object({
  name: z.string().trim().min(1, "Give the connection a name.").max(64, "Keep the name under 64 characters.").regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, numbers and dashes, starting with a letter."),
  url: z.url({ protocol: /^https?$/, error: "Use an http or https address." }),
  headers: z
    .array(Header)
    .refine((headers) => headers.every((header) => header.saved || (header.name && header.value)), "Give every new header a name and a value.")
    .refine((headers) => headers.every((header) => /^[A-Za-z0-9-]+$/.test(header.name)), "Header names use letters, numbers and dashes.")
    .refine((headers) => new Set(headers.map((header) => header.name.toLowerCase())).size === headers.length, "Use each header name once."),
  description: z.string().trim().max(1000, "Keep the description under 1000 characters."),
})

type Values = z.infer<typeof Schema>
export type Header = z.infer<typeof Header>

// The connection panel's form: create a new connection or save one, check its server, and delete it after a confirm. onDone runs after a save or a delete.
export function useConnectionForm(persona: Persona, connection: Connection | null, onDone: () => void) {
  const add = useAddConnection(persona.id)
  const update = useUpdateConnection({ id: connection?.id ?? "", personaId: persona.id })
  const remove = useRemoveConnection(persona.id)
  const check = useCheckConnection()
  const [confirming, setConfirming] = useState(false)
  const [checked, setChecked] = useState<{ draft: string; probe: ConnectionCheck }>()
  const savedHeaders = connection?.headers ?? []
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: connection?.name ?? "", url: connection?.url ?? "", headers: savedHeaders.map((name) => ({ name, value: "", saved: true })), description: connection?.description ?? "" } })
  const [url, headers] = useWatch({ control: form.control, name: ["url", "headers"] })
  const saving = add.isMutating || update.isMutating

  // A check answers for the address and headers it ran with, so a change to them hides it
  const draft = JSON.stringify([url, headers])
  const probe = checked?.draft === draft ? checked.probe : undefined

  function submit(values: Values) {
    if (connection) return updateConnection(values)
    return addConnection(values)
  }

  async function addConnection(values: Values) {
    const added = await add.trigger({ name: values.name, url: values.url, description: values.description, headers: valuesOf(values.headers) })
    if (!added) return

    toast.add({ title: `Created “${added.name}”`, type: "success" })
    onDone()
  }

  async function updateConnection(values: Values) {
    const saved = await update.trigger({ name: values.name, url: values.url, description: values.description, headers: changesOf(values.headers, savedHeaders) })
    if (!saved) return

    toast.add({ title: `Saved “${saved.name}”`, type: "success" })
    onDone()
  }

  async function deleteConnection() {
    if (!connection) return
    await remove.trigger(connection.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Deleted “${connection.name}”`, type: "success" })
        onDone()
      },
    })
  }

  // A saved connection is checked with the changes on top, so the check needs none of its secret values
  async function checkServer() {
    const valid = await form.trigger(["url", "headers"])
    if (!valid) return

    const input = connection ? { connectionId: connection.id, url, headers: changesOf(headers, savedHeaders) } : { url, headers: valuesOf(headers) }
    const result = await check.trigger(input)
    if (!result) return

    setChecked({ draft, probe: result })
  }

  return { form, submit: form.handleSubmit(submit), saving, deleting: remove.isMutating, confirming, setConfirming, deleteConnection, checking: check.isMutating, probe, checkServer }
}

// The values typed: each sets its header
function valuesOf(headers: Header[]) {
  const values = Object.fromEntries(headers.filter((header) => header.value).map((header) => [header.name, header.value] as const))
  return values
}

// The change the server merges: the values typed, and null for each saved header taken out of the list
function changesOf(headers: Header[], saved: string[]) {
  const names = headers.map((header) => header.name)
  const removed = Object.fromEntries(saved.filter((name) => !names.includes(name)).map((name) => [name, null] as const))
  const changes = { ...removed, ...valuesOf(headers) }
  return changes
}
