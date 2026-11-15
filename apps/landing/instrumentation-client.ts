import posthog from "posthog-js"

// Starts PostHog in the browser before the site hydrates; the landing shares the persona project, so one visitor id spans the landing and the app
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
if (key) {
  posthog.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST, ui_host: "https://us.posthog.com", defaults: "2026-08-30", capture_exceptions: true })
  posthog.register({ environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development" })
}
