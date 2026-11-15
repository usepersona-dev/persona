"use client"

import { useUser } from "@clerk/nextjs"
import posthog from "posthog-js"
import { useEffect } from "react"

// Names the browser's PostHog visitor after the Clerk user once Clerk has loaded, and starts a fresh visitor after a sign-out. The visitor id lives in a cookie on the parent domain, so the landing and the docs count the same person
export function PostHogIdentify() {
  const { isLoaded, isSignedIn, user } = useUser()

  useEffect(() => {
    if (!isLoaded || !posthog.__loaded) return
    if (isSignedIn) { posthog.identify(user.id, { email: user.primaryEmailAddress?.emailAddress, name: user.fullName }); return }
    if (posthog.get_property("$user_state") === "identified") posthog.reset()
  }, [isLoaded, isSignedIn, user])

  return null
}
