import "server-only"

import { err, type FailureCode, ok, type Result } from "@/lib/errors"
import { reportError, visitorOf } from "@/lib/posthog"
import { authenticateApiKey } from "@/usecases/api-keys"
import { getSession, type Caller } from "@/usecases/auth"

type Context<Params> = { params: Promise<Params> }
type Handler<Params> = (caller: Caller, params: Params, request: Request) => Promise<Result<unknown>>
type PublicHandler<Params> = (params: Params, request: Request) => Promise<Result<unknown>>
type OptionalHandler<Params> = (caller: Caller | null, params: Params, request: Request) => Promise<Result<unknown>>

const STATUS: Record<FailureCode, number> = { not_found: 404, invalid: 400, conflict: 409 }
const POSTGRES_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}(:\d{2})?$/

export function handler<Params>(run: Handler<Params>) {
  return async (request: Request, context: Context<Params>) => {
    try {
      const caller = await findCaller(request)
      if (!caller) return failure(401, "unauthorized", "Sign in, or send a valid API key.")

      const params = await context.params
      const result = await run(caller, params, request)
      if (!result.ok) return failure(STATUS[result.error.code], result.error.code, result.error.message)

      return success(result.value)
    } catch (error) {
      const response = await failed(error, request)
      return response
    }
  }
}

export function publicHandler<Params>(run: PublicHandler<Params>) {
  return async (request: Request, context: Context<Params>) => {
    try {
      const params = await context.params
      const result = await run(params, request)
      if (!result.ok) return failure(STATUS[result.error.code], result.error.code, result.error.message)

      return success(result.value)
    } catch (error) {
      const response = await failed(error, request)
      return response
    }
  }
}

// A route open to everyone that also knows the member, when one is signed in or sends an API key
export function optionalHandler<Params>(run: OptionalHandler<Params>) {
  return async (request: Request, context: Context<Params>) => {
    try {
      const caller = await findCaller(request)
      const params = await context.params
      const result = await run(caller, params, request)
      if (!result.ok) return failure(STATUS[result.error.code], result.error.code, result.error.message)

      return success(result.value)
    } catch (error) {
      const response = await failed(error, request)
      return response
    }
  }
}

export async function readJson(request: Request) {
  const text = await request.text()
  if (text.trim() === "") return ok({})

  const body = parseJson(text)
  if (body === undefined) return err("invalid", "Send the request body as JSON.")
  if (typeof body !== "object" || body === null || Array.isArray(body)) return err("invalid", "Send the request body as a JSON object.")

  return ok(body)
}

async function findCaller(request: Request): Promise<Caller | null> {
  const apiKey = readApiKey(request)
  if (apiKey) {
    const caller = await authenticateApiKey(apiKey)
    return caller
  }

  const caller = await findSessionCaller()
  return caller
}

async function findSessionCaller(): Promise<Caller | null> {
  const session = await getSession()
  if (session.status !== "active") return null
  return session.caller
}

function readApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization")
  if (!authorization) return null

  const [scheme, token] = authorization.trim().split(/\s+/)
  if (scheme.toLowerCase() !== "bearer" || !token) return null

  return token
}

function parseJson(text: string) {
  try {
    const body = JSON.parse(text)
    return body
  } catch {
    return undefined
  }
}

function success(result: unknown) {
  if (result === undefined) return new Response(null, { status: 204 })

  const body = JSON.stringify(result, toIsoTime)
  const response = new Response(body, { headers: { "content-type": "application/json" } })
  return response
}

function failure(status: number, code: string, message: string) {
  const response = Response.json({ error: { code, message } }, { status })
  return response
}

// An error caught here never reaches Next's onRequestError, so it goes to PostHog from here, as the browser's visitor (the signed-in user) when the call carries the cookie
async function failed(error: unknown, request: Request) {
  console.error(error)
  await reportError(error, visitorOf(request.headers.get("cookie")), { path: new URL(request.url).pathname, method: request.method, routeType: "api" })
  return failure(500, "server_error", "Something went wrong. Try again.")
}

function toIsoTime(key: string, value: unknown) {
  if (typeof value !== "string" || !POSTGRES_TIME.test(value)) return value

  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return value

  const iso = time.toISOString()
  return iso
}
