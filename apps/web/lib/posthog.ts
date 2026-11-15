import { PostHog } from "posthog-node"

// Sends one server error to PostHog and waits for it, since a Vercel function may freeze right after it answers; a deployment without a key sends nothing
export async function reportError(error: unknown, distinctId: string | undefined, properties: Record<string, unknown>) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  const client = new PostHog(key, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST, flushAt: 1, flushInterval: 0 })
  await client.captureExceptionImmediate(error, distinctId, { ...properties, environment: process.env.VERCEL_ENV ?? "development", deployment: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "local" })
  await client.shutdown()
}

// posthog-js keeps the visitor in the ph_<key>_posthog cookie as URL-encoded JSON (PostHog's Next.js error tracking guide reads distinct_id from it)
export function visitorOf(cookies: string | null | undefined) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || !cookies) return undefined

  const value = new RegExp(`(?:^|;\\s*)ph_${key}_posthog=([^;]+)`).exec(cookies)?.[1]
  if (!value) return undefined

  try {
    const state = JSON.parse(decodeURIComponent(value)) as { distinct_id?: string }
    return state.distinct_id
  } catch {
    return undefined
  }
}
