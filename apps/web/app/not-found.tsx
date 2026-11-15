import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"

import { MessagePage, MessagePageActions, MessagePageDescription, MessagePageTitle } from "../components/message-page"

export const metadata: Metadata = { title: "Page not found · Persona" }

export default function NotFound() {
  return (
    <MessagePage>
      <MessagePageTitle>Page not found</MessagePageTitle>
      <MessagePageDescription>The link may be old, or the page has moved.</MessagePageDescription>
      <MessagePageActions>
        <Button size="lg" nativeButton={false} render={<Link href="/" />}>
          Go to your projects
        </Button>
        <p className="text-sm text-muted-foreground">
          Or go to the{" "}
          <Button variant="link" nativeButton={false} render={<Link href={process.env.NEXT_PUBLIC_SITE_URL!} />} className="h-auto p-0">
            home page
          </Button>
        </p>
      </MessagePageActions>
    </MessagePage>
  )
}
