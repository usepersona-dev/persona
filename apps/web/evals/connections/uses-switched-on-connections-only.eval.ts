import type { EveEvalTurn } from "eve/evals"
import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { marker } from "@/evals/shared"
import { addConnection, listConnections, updateConnection } from "@/usecases/connections"

// The persona uses its creator's switched-on MCP connections and can't reach a switched-off one. The connections load when a turn starts, so switching one on mid-chat applies from the next message. DeepWiki's public MCP server, which needs no sign-in, stands in for a creator's server, and its vault header checks that saved headers reach each request
const DEEPWIKI = "https://mcp.deepwiki.com/mcp"

export default defineEval<typeof config>({
  description: "The persona uses switched-on MCP connections only, and a switch applies from the next message.",
  tags: ["connections"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()

    const on = await addConnection(caller, personaId, { name: "deepwiki", url: DEEPWIKI, description: "Reads the wiki of a public GitHub repository.", headers: { "x-eval-check": marker("eval") } })
    if (!on.ok) throw new Error(on.error.message)
    const off = await addConnection(caller, personaId, { name: "wiki-two", url: DEEPWIKI, description: "A second reader for the wiki of a public GitHub repository.", enabled: false })
    if (!off.ok) throw new Error(off.error.message)

    const first = await t.send("Use your deepwiki tools to list two topics from the wiki of the GitHub repository vercel/next.js.", { headers })
    t.check(callsTo(first, "deepwiki").length, satisfies((count) => Number(count) > 0, "it calls the switched-on connection"))

    const second = await first.session.send("Now use your wiki-two tools to do the same for facebook/react. If you don't have them, just tell me, without changing any settings or handing it to anyone else.", { headers })
    t.check(callsTo(second, "wiki-two").length, satisfies((count) => Number(count) === 0, "the switched-off connection has no tools to call"))

    const listed = await listConnections(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const stillOff = listed.value.some((connection) => connection.name === "wiki-two" && !connection.enabled)
    t.check(stillOff, satisfies((value) => value === true, "wiki-two is still off before the eval switches it on"))

    const switched = await updateConnection(caller, off.value.id, { enabled: true })
    if (!switched.ok) throw new Error(switched.error.message)

    const third = await first.session.send("I turned wiki-two on. Use your wiki-two tools for facebook/react now.", { headers })
    t.check(callsTo(third, "wiki-two").length, satisfies((count) => Number(count) > 0, "the connection switched on mid-chat works from the next message"))

    t.log(`first ${tools(first)} | second ${tools(second)} | third ${tools(third)}`)
    t.succeeded()
  },
})

function callsTo(turn: EveEvalTurn, connection: string) {
  const calls = turn.toolCalls.filter((call) => call.name.includes(connection))
  return calls
}

function tools(turn: EveEvalTurn) {
  const names = turn.toolCalls.map((call) => call.name).join(", ")
  return names
}
