"use client"

import type { MessageContent, MessagePart } from "eve/channels"
import { useEveAgent } from "eve/react"
import { useState } from "react"

import { useGetAgentToken } from "@/hooks/agent"
import { useRemoveFile, useUploadFile, type FileDetail } from "@/hooks/files"

import { outgoing, type ChatItem } from "./chat-rows"

// The Chat tab's session, on eve's own hook. A message shows the moment it is sent, as eve's stand-in, and eve accepts it only after copying its files into the persona's sandbox, so the chat keeps the sent files to show them meanwhile.
// A picked file goes to the persona's Files at once and the message carries its link: eve gives the chat back only http links, and Vercel caps a request at 4.5 MB
export function usePersonaChat(personaId: string) {
  const getToken = useGetAgentToken(personaId)
  const upload = useUploadFile(personaId)
  const remove = useRemoveFile(personaId)
  const [sent, setSent] = useState<FileDetail[]>([])

  async function bearer() {
    const created = await getToken.trigger()
    if (!created) throw new Error("The chat could not sign in. Try again.")
    return created.token
  }

  const agent = useEveAgent({ auth: { bearer } })
  const busy = agent.status === "busy"

  function send(text: string, files: FileDetail[], reply?: ChatItem) {
    const said = outgoing(text, reply)
    const content: MessagePart[] = []
    if (said) content.push({ type: "text", text: said })
    for (const file of files) content.push({ type: "file", data: file.url, mediaType: file.contentType, filename: file.name })
    setSent((current) => [...current, ...files])

    const message = files.length === 0 ? said : content
    post(message)
  }

  // A message sent while a turn is open steers it, eve's default for follow-ups. eve's send resolves once the message is accepted and a failure shows on the session, so nothing waits on it
  function post(message: MessageContent) {
    void agent.send(message).catch(() => undefined)
  }

  return { agent, busy, send, sent, upload: upload.trigger, discard: remove.trigger }
}
