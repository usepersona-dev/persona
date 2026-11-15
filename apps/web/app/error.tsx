"use client"

import Link from "next/link"
import posthog from "posthog-js"
import { useEffect, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { MessagePage, MessagePageActions, MessagePageDescription, MessagePageTitle } from "../components/message-page"

// retry() refetches and re-renders the page inside a transition, so the button shows "Trying again" until it settles.
// The digest names a server error in the logs; client errors have none.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [trying, startTrying] = useTransition()

  useEffect(() => {
    posthog.captureException(error)
  }, [error])

  function tryAgain() {
    startTrying(() => retry())
  }

  return (
    <MessagePage>
      <MessagePageTitle>Something went wrong</MessagePageTitle>
      <MessagePageDescription>We couldn&apos;t load this page. Please try again.</MessagePageDescription>
      <MessagePageActions>
        <Button size="lg" disabled={trying} onClick={tryAgain}>
          {trying && <Spinner />}
          {trying ? "Trying again" : "Try again"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Or go to the{" "}
          <Button variant="link" nativeButton={false} render={<Link href={process.env.NEXT_PUBLIC_SITE_URL!} />} className="h-auto p-0">
            home page
          </Button>
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70">
            Error ID <span className="font-bold tabular-nums select-all">{error.digest}</span>
          </p>
        )}
      </MessagePageActions>
    </MessagePage>
  )
}
