import type { SessionAuthContext, SessionContext } from "eve/context"
import { z } from "zod"

import { ok } from "@/lib/errors"
import { signJwt } from "@/lib/jwt"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

export const AGENT_TOKEN = { algorithm: "HS256", issuer: "persona", audiences: ["persona-agent"] } as const

const TOKEN_TTL_SECONDS = 15 * 60
const principalAttributes = z.object({ orgId: z.string().min(1), userId: z.string().min(1), personaId: z.string().min(1), linkId: z.string().min(1).optional(), channel: z.enum(["web", "telegram", "whatsapp", "automation", "webhook", "trigger", "unknown"]).default("unknown") })

export const RUN_CHANNELS = ["automation", "trigger", "webhook"]

type WithAuth = { session: Pick<SessionContext["session"], "auth"> }

export async function createAgentToken(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const secret = readAgentTokenSecret()
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS

  const claims = { iss: AGENT_TOKEN.issuer, aud: AGENT_TOKEN.audiences[0], sub: caller.userId, iat: issuedAt, exp: expiresAt, orgId: caller.orgId, userId: caller.userId, personaId: persona.value.id }
  const token = signJwt(claims, secret)
  const expires = new Date(expiresAt * 1000).toISOString()
  const agentToken = { token, expiresAt: expires }
  return ok(agentToken)
}

export function readAgentTokenSecret() {
  const secret = process.env.AGENT_TOKEN_SECRET
  if (!secret) throw new Error("AGENT_TOKEN_SECRET is not set.")
  return secret
}

export function toPrincipal(attributes: unknown) {
  const parsed = principalAttributes.safeParse(attributes)
  if (!parsed.success) return null

  const principal: SessionAuthContext = { authenticator: "persona", issuer: "persona", principalId: parsed.data.userId, principalType: "user", subject: parsed.data.userId, attributes: parsed.data }
  return principal
}

export async function getSession(principal: SessionAuthContext, sessionId: string) {
  const { personaId } = principalAttributes.parse(principal.attributes)
  const session = await db.orm.public.Session.where({ id: sessionId, personaId }).select("id").first()
  return session
}

export function readCaller(ctx: WithAuth) {
  const initiator = ctx.session.auth.initiator
  const parsed = principalAttributes.safeParse(initiator?.attributes)
  if (!parsed.success) throw new Error("This session is not tied to a persona.")

  const caller: Caller = { orgId: parsed.data.orgId, userId: parsed.data.userId, personaId: parsed.data.personaId }
  const agentCaller = { caller, personaId: parsed.data.personaId, linkId: parsed.data.linkId, channel: parsed.data.channel }
  return agentCaller
}
