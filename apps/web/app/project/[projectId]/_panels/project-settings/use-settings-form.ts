"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useUpdateProject, type Project } from "@/hooks/projects"
import { useUpload } from "@/hooks/uploads"

// The server checks the same rules
const Schema = z.object({
  name: z.string().trim().min(1, "Give the project a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters."),
})

type Values = z.infer<typeof Schema>

// The project's name, description and picture. The name and description wait for Save. A picked picture uploads and saves right away; Remove saves null, and the picture is made from the name again.
export function useSettingsForm(project: Project) {
  const update = useUpdateProject(project.id)
  const upload = useUpload()
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: project.name, description: project.description ?? "" } })
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
    const saved = await update.trigger({ name: values.name, description: values.description || null })
    if (!saved) return

    form.reset({ name: saved.name, description: saved.description ?? "" })
    toast.add({ title: "Project updated", type: "success" })
  }

  return { form, name, changePicture, removePicture, submit: form.handleSubmit(submit) }
}
