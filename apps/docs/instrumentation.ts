import type { Instrumentation } from "next"

// Reports the server errors Next catches (renders, the Ask AI route, the proxy) to PostHog, as the visitor who made the request
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || process.env.NEXT_RUNTIME !== "nodejs") return

  const visitor = visitorOf(request.headers, key)
  const { PostHog } = await import("posthog-node")
  const client = new PostHog(key, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST, flushAt: 1, flushInterval: 0 })
  await client.captureExceptionImmediate(error, { distinctId: visitor, properties: { path: request.path, method: request.method, routerKind: context.routerKind, routeType: context.routeType, environment: process.env.VERCEL_ENV ?? "development" } })
  await client.shutdown()
}

// posthog-js keeps the visitor in the ph_<key>_posthog cookie as URL-encoded JSON (PostHog's Next.js error tracking guide reads distinct_id from it)
function visitorOf(headers: Record<string, string | string[] | undefined>, key: string) {
  const cookies = [headers.cookie ?? []].flat().join("; ")
  const value = new RegExp(`(?:^|;\\s*)ph_${key}_posthog=([^;]+)`).exec(cookies)?.[1]
  if (!value) return undefined

  try {
    const state = JSON.parse(decodeURIComponent(value)) as { distinct_id?: string }
    return state.distinct_id
  } catch {
    return undefined
  }
}
