import { err, ok } from "@/lib/errors"
import * as eve from "@/lib/eve"
import { db } from "@/prisma/db"
import { createAgentToken } from "@/usecases/agent"
import type { Caller } from "@/usecases/auth"
import { getPersona } from "@/usecases/personas"

type Turn = { sessionId: string; personaId: string; userId: string; channel: string; address?: string; at: string }
type File = { name: string | null; type: string; size: number | null; url: string | null }
type Message = { id: string; sessionId: string; turnId: string; role: "user" | "assistant" | "system"; tool?: string; text: string; files?: File[]; at: string }

// ## Crud

export async function listSessions(caller: Caller, personaId: string) {
  const persona = await getPersona(caller, personaId)
  if (!persona.ok) return persona

  const sessions = await db.orm.public.Session.where({ personaId }).orderBy((session) => session.createdAt.desc()).all()
  return ok(sessions)
}

export async function listMessages(caller: Caller, sessionId: string, limit: number) {
  const session = await readSession(caller, sessionId)
  if (!session.ok) return session

  const latest = await db.orm.public.Message.where({ sessionId }).orderBy((message) => message.createdAt.desc()).limit(limit).all()
  const messages = latest.reverse()
  return ok(messages)
}

export async function findActiveSession(address: string) {
  const session = await db.orm.public.Session.where({ address }).where((session) => session.status.in(["running", "waiting"])).orderBy((session) => session.createdAt.desc()).first()
  return ok(session ?? null)
}

// ## Actions

export async function clearChat(caller: Caller, address: string) {
  const session = await findActiveSession(address)
  if (!session.ok) return session
  if (!session.value) return ok(null)

  const cleared = await clearSession(caller, session.value.id)
  return cleared
}

export async function resetChat(caller: Caller, address: string) {
  const session = await findActiveSession(address)
  if (!session.ok) return session
  if (!session.value) return ok(null)

  const reset = await resetSession(caller, session.value.id)
  return reset
}

export async function clearSession(caller: Caller, sessionId: string) {
  const session = await readSession(caller, sessionId)
  if (!session.ok) return session

  const token = await createAgentToken(caller, session.value.personaId)
  if (!token.ok) return token

  const cleared = await eve.clearSession(sessionId, token.value.token)
  return ok(cleared)
}

export async function resetSession(caller: Caller, sessionId: string) {
  const session = await readSession(caller, sessionId)
  if (!session.ok) return session

  const token = await createAgentToken(caller, session.value.personaId)
  if (!token.ok) return token

  const reset = await eve.resetSession(sessionId, token.value.token)
  return ok(reset)
}

export async function compactSession(caller: Caller, sessionId: string) {
  const session = await readSession(caller, sessionId)
  if (!session.ok) return session

  const token = await createAgentToken(caller, session.value.personaId)
  if (!token.ok) return token

  const compacted = await eve.compactSession(sessionId, token.value.token)
  return ok(compacted)
}

export async function cancelTurn(caller: Caller, sessionId: string) {
  const session = await readSession(caller, sessionId)
  if (!session.ok) return session

  const token = await createAgentToken(caller, session.value.personaId)
  if (!token.ok) return token

  const cancelled = await eve.cancelTurn(sessionId, token.value.token)
  return ok(cancelled)
}

// ## Events

export async function recordTurnStart(turn: Turn) {
  const updated = await db.orm.public.Session.where({ id: turn.sessionId }).updateAll({ status: "running", lastTurnAt: turn.at, userId: turn.userId, channel: turn.channel, address: turn.address ?? null })
  if (updated.length > 0) return

  await db.orm.public.Session.createAll([{ id: turn.sessionId, personaId: turn.personaId, userId: turn.userId, channel: turn.channel, address: turn.address ?? null, status: "running", lastTurnAt: turn.at }], { onConflict: "skip", conflictOn: ["id"] })
}

export async function recordSessionWaiting(sessionId: string) {
  await db.orm.public.Session.where({ id: sessionId }).updateAll({ status: "waiting" })
}

export async function recordSessionEnd(sessionId: string, status: "ended" | "failed", at: string) {
  await db.orm.public.Session.where({ id: sessionId }).where((session) => session.status.in(["running", "waiting"])).updateAll({ status, endedAt: at })
}

export async function recordMessage(message: Message) {
  await db.orm.public.Message.createAll([{ id: message.id, sessionId: message.sessionId, turnId: message.turnId, role: message.role, tool: message.tool ?? null, text: message.text, files: message.files ?? null, createdAt: message.at }], { onConflict: "skip", conflictOn: ["id"] })
}

// ## Helpers

async function readSession(caller: Caller, sessionId: string) {
  const session = await db.orm.public.Session.where({ id: sessionId }).first()
  if (!session) return err("not_found", "This chat does not exist.")

  const persona = await getPersona(caller, session.personaId)
  if (!persona.ok) return err("not_found", "This chat does not exist.")

  return ok(session)
}
