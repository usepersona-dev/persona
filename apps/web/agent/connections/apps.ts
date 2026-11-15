import { defineDynamic, defineMcpClientConnection } from "eve/connections"

import { readCaller } from "@/usecases/agent"
import { openAppsSession } from "@/usecases/integrations"

export default defineDynamic(async (ctx) => {
  const { caller, personaId } = readCaller(ctx)
  const turnId = ctx.turn?.id
  if (!turnId) return null

  // eve runs this before every model call and fails the whole turn when it throws. Opening is a call to Composio, so it runs once per turn, and an app connected mid-chat shows up on the next one. When Composio is down the persona goes on without apps, and the next model call tries again
  try {
    const session = await ctx.memo(turnId, async () => {
      const opened = await openAppsSession(caller, personaId)
      if (!opened.ok) throw new Error(opened.error.message)
      return opened.value
    })

    const connected = session.names.length > 0 ? `Connected now: ${session.names.join(", ")}.` : "No apps are connected yet."
    const description = `Apps such as Gmail, Google Calendar, Slack, Notion and GitHub. ${connected} Search an app's tools and run them. When the person wants an app that isn't connected, start its connection and send them the link.`
    const connection = defineMcpClientConnection({ url: session.url, headers: session.headers, description, instanceKey: `composio:${session.sessionId}` })
    return connection
  } catch (error) {
    console.error("Apps did not open, so this step goes on without them.", personaId, error)
    return null
  }
})
