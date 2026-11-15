"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useCreatePersona, useDuplicatePersona, usePersonas } from "@/hooks/personas"

import { usePanels } from "./use-panels"

// The server checks the same rule
const Schema = z.object({ name: z.string().trim().min(1, "Give the persona a name.").max(80, "Keep the name under 80 characters.") })

type Values = z.infer<typeof Schema>

// The New persona panel: Blank or a persona to copy, picked in the strip, and the name. A copy's name starts as "<name> (copy)" and follows the pick until it is typed in. Once created, the new persona opens.
export function useCreatePersonaForm(projectId: string, from: string) {
  const panels = usePanels()
  const { personas } = usePersonas(projectId)
  const [pickedId, setPickedId] = useState(from === "new" ? null : from)
  const picked = personas?.find((persona) => persona.id === pickedId) ?? null
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: picked ? `${picked.name} (copy)` : "" } })
  const name = useWatch({ control: form.control, name: "name" })
  const create = useCreatePersona(projectId)
  const duplicate = useDuplicatePersona({ id: pickedId ?? "", projectId })
  const creating = create.isMutating || duplicate.isMutating

  function pick(personaId: string | null) {
    setPickedId(personaId)
    if (form.getFieldState("name").isDirty) return

    const source = personas?.find((persona) => persona.id === personaId)
    form.setValue("name", source ? `${source.name} (copy)` : "")
  }

  async function submit(values: Values) {
    const created = pickedId ? await duplicate.trigger({ name: values.name }) : await create.trigger({ name: values.name })
    if (!created) return

    toast.add({ title: `Created “${created.name}”`, type: "success" })
    panels.openPersona(created.id)
  }

  return { form, personas, picked, name, creating, pick, submit: form.handleSubmit(submit) }
}
