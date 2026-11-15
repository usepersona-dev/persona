"use client"

import { toast } from "@/components/ui/toast"
import { useConnectApp, type App } from "@/hooks/integrations"

// Connects an app: the server gives its sign-in link, which opens in a popup. An app that needs no sign-in connects at once.
export function useConnectPopup(personaId: string) {
  const connect = useConnectApp(personaId)

  async function open(app: App) {
    const connection = await connect.trigger({ toolkit: app.toolkit })
    if (!connection) return
    if (!connection.url) return toast.add({ title: `${app.name} connected`, type: "success" })
    const popup = window.open(connection.url, "connect-app", "width=520,height=720")
    if (!popup) toast.add({ title: "Allow popups for this site to finish connecting.", type: "error" })
  }

  return { open, connecting: connect.isMutating }
}
