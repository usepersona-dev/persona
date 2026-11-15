"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useAddInstruction, useRemoveInstruction, useUpdateInstruction, type Instruction } from "@/hooks/instructions"
import type { Persona } from "@/hooks/personas"

// The server checks the same rules, and that no other instruction of the persona has the name
const Schema = z.object({
  name: z.string().trim().min(1, "Give the instruction a name.").max(80, "Keep the name under 80 characters."),
  content: z.string().trim().min(1, "Write the instruction.").max(50_000, "Keep it under 50,000 characters."),
})

type Values = z.infer<typeof Schema>

// The instruction panel's form: create a new instruction or save one, and delete it after a confirm. onDone runs after each of them.
export function useInstructionForm(persona: Persona, instruction: Instruction | null, onDone: () => void) {
  const add = useAddInstruction(persona.id)
  const update = useUpdateInstruction({ id: instruction?.id ?? "", personaId: persona.id })
  const remove = useRemoveInstruction(persona.id)
  const [confirming, setConfirming] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: instruction?.name ?? "", content: instruction?.content ?? "" } })
  const saving = add.isMutating || update.isMutating

  function submit(values: Values) {
    if (instruction) return updateInstruction(values)
    return addInstruction(values)
  }

  async function addInstruction(values: Values) {
    const added = await add.trigger(values)
    if (!added) return

    toast.add({ title: `Created “${added.name}”`, type: "success" })
    onDone()
  }

  async function updateInstruction(values: Values) {
    const saved = await update.trigger(values)
    if (!saved) return

    toast.add({ title: `Saved “${saved.name}”`, type: "success" })
    onDone()
  }

  async function deleteInstruction() {
    if (!instruction) return
    await remove.trigger(instruction.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Deleted “${instruction.name}”`, type: "success" })
        onDone()
      },
    })
  }

  return { form, submit: form.handleSubmit(submit), saving, deleting: remove.isMutating, confirming, setConfirming, deleteInstruction }
}
