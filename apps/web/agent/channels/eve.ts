import { extractBearerToken, localDev, verifyJwtHmac, type AuthFn } from "eve/channels/auth"
import { eveChannel } from "eve/channels/eve"
import type { SessionAuthContext } from "eve/context"

import { AGENT_TOKEN, getSession, readAgentTokenSecret, toPrincipal } from "@/usecases/agent"

const SESSION_ROUTES = "/eve/v1/session/"

// Who is calling, then whether they may touch the session they ask for
const agentToken: AuthFn<Request> = async (request) => {
  const principal = await verifyToken(request)
  if (!principal) return null

  await requireOwnSession(principal, request)
  return principal
}

// A valid Persona token, as a principal for its persona. Null lets the next auth try
async function verifyToken(request: Request) {
  const header = request.headers.get("authorization")
  const token = extractBearerToken(header)
  if (!token) return null

  const secret = readAgentTokenSecret()
  const verified = await verifyJwtHmac(token, { ...AGENT_TOKEN, secret })
  if (!verified.ok) return null

  const attributes = {...verified.sessionAuth.attributes, channel: "web"}
  const principal = toPrincipal(attributes)
  return principal
}

// Under the session routes, only a session of the token's persona, as eve checks no owner per session. A new chat's row is written when its first turn starts, a moment after its stream opens, so the refusal is eve's own "not ready" 409, which eve's client retries; a 401 or 403 would fail the chat
async function requireOwnSession(principal: SessionAuthContext, request: Request) {
  const path = new URL(request.url).pathname
  if (!path.startsWith(SESSION_ROUTES)) return

  const sessionId = decodeURIComponent(path.slice(SESSION_ROUTES.length).split("/")[0])
  const session = await getSession(principal, sessionId)
  if (!session) throw { response: Response.json({ code: "session_not_ready" }, { status: 409 }) }
}

export default eveChannel({ auth: [agentToken, localDev()] })
