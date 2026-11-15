"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useUpdatePersona, type Persona } from "@/hooks/personas"
import { useUpload } from "@/hooks/uploads"

// The server checks the same rules
const Schema = z.object({
  name: z.string().trim().min(1, "Give the persona a name.").max(80, "Keep the name under 80 characters."),
})

type Values = z.infer<typeof Schema>

// The persona's name and picture. The name waits for Save. A picked picture uploads and saves right away; Remove saves null, and the face is made from the name again.
export function useSettingsForm(persona: Persona) {
  const update = useUpdatePersona(persona)
  const upload = useUpload()
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: persona.name } })
  const name = useWatch({ control: form.control, name: "name" })

  async function changePicture(file: File) {
    const imageUrl = await upload.trigger(file)
    if (!imageUrl) return

    const saved = await update.trigger({ imageUrl })
    if (saved) toast.add({ title: "Picture updated", type: "success" })
  }

  async function removePicture() {
    const saved = await update.trigger({ imageUrl: null })
    if (saved) toast.add({ title: "Picture removed", type: "success" })
  }

  async function submit(values: Values) {
    const saved = await update.trigger({ name: values.name })
    if (!saved) return

    form.reset({ name: saved.name })
    toast.add({ title: "Persona updated", type: "success" })
  }

  return { form, name, changePicture, removePicture, submit: form.handleSubmit(submit) }
}
