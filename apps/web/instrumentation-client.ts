import posthog from "posthog-js"

// Starts PostHog in the browser before the app hydrates; a deployment without a key sends nothing. Every event names its deployment by the project's production domain, which Vercel sets even on previews
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
if (key) {
  posthog.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST, ui_host: "https://us.posthog.com", defaults: "2026-08-30", capture_exceptions: true })
  posthog.register({ environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development", deployment: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? "local" })
}
