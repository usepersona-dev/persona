"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { toast } from "@/components/ui/toast"
import { useConnectMetaLine } from "@/hooks/whatsapp-meta"

// The server checks the same rules, then tests the keys with Meta
const Schema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d+$/, "The phone number ID is on your app's WhatsApp > API Setup page."),
  wabaId: z.string().trim().regex(/^\d+$/, "The messaging account ID is next to the phone number ID, on the same page."),
  appId: z.string().trim().regex(/^\d+$/, "The App ID is the number at the top of your app's dashboard."),
  appSecret: z.string().trim().regex(/^[a-f0-9]{32}$/i, "The App Secret is the 32-character code under App settings > Basic."),
  accessToken: z.string().trim().min(20, "That does not look like a Meta access token. Copy the system user's token again."),
})

export type ConnectNumberValues = z.infer<typeof Schema>

// Bring your number: its two IDs, the app's ID and secret, and the token. Saving tests them with Meta; what Meta refuses shows as a toast, and the dialog stays open to fix it
export function useConnectNumberForm(projectId: string, onDone: () => void) {
  const connect = useConnectMetaLine(projectId)
  const form = useForm<ConnectNumberValues>({ resolver: zodResolver(Schema), defaultValues: { phoneNumberId: "", wabaId: "", appId: "", appSecret: "", accessToken: "" } })

  async function submit(values: ConnectNumberValues) {
    const line = await connect.trigger(values)
    if (!line) return

    toast.add({ title: `Connected ${line.number}`, type: "success" })
    onDone()
  }

  return { form, connecting: connect.isMutating, submit: form.handleSubmit(submit) }
}
