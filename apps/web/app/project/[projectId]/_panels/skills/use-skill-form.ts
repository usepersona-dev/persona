"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import type { Persona } from "@/hooks/personas"
import { useAddSkill, useRemoveSkill, useUpdateSkill, type Skill } from "@/hooks/skills"

// The server checks the same rules, and that no other skill of the persona has the name
const Schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the skill a name.")
    .max(64, "Keep the name under 64 characters.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes for the skill name.")
    .refine((value) => value !== "eve", "Persona uses this name. Pick another."),
  description: z.string().trim().min(1, "Describe when the skill should be used.").max(1024, "Keep the description under 1024 characters."),
  markdown: z.string().max(200_000, "Keep the skill under 200,000 characters."),
})

type Values = z.infer<typeof Schema>

// The skill panel's form: create a new skill or save one, and delete it after a confirm. onDone runs after each of them. A skill's files stay as they are.
export function useSkillForm(persona: Persona, skill: Skill | null, onDone: () => void) {
  const add = useAddSkill(persona.id)
  const update = useUpdateSkill({ id: skill?.id ?? "", personaId: persona.id })
  const remove = useRemoveSkill(persona.id)
  const [confirming, setConfirming] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: skill?.name ?? "", description: skill?.description ?? "", markdown: skill?.markdown ?? "" } })
  const saving = add.isMutating || update.isMutating

  function submit(values: Values) {
    if (skill) return updateSkill(values)
    return addSkill(values)
  }

  async function addSkill(values: Values) {
    const added = await add.trigger(values)
    if (!added) return

    toast.add({ title: `Created “${added.name}”`, type: "success" })
    onDone()
  }

  async function updateSkill(values: Values) {
    const saved = await update.trigger(values)
    if (!saved) return

    toast.add({ title: `Saved “${saved.name}”`, type: "success" })
    onDone()
  }

  async function deleteSkill() {
    if (!skill) return
    await remove.trigger(skill.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Deleted “${skill.name}”`, type: "success" })
        onDone()
      },
    })
  }

  return { form, submit: form.handleSubmit(submit), saving, deleting: remove.isMutating, confirming, setConfirming, deleteSkill }
}
