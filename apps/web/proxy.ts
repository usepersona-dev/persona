import { clerkMiddleware } from "@clerk/nextjs/server"
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server"

const clerk = clerkMiddleware()
const FILES_PREVIEW = new URL(process.env.FILES_PREVIEW_URL!)

// Every request comes through here first, and the host it was sent to decides where it goes:
//   files.usepersona.dev, the preview host   -> the preview page of a published file, in app/files
//   any other host, the app                  -> the app, after Clerk has read who is signed in
// The preview host has no users, so Clerk stays out of it
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // The Host header
  const host = request.headers.get("host") || ""
  const hostname = host.split(":")[0]

  if (isPreviewHost(hostname)) {
    const previewPage = new URL(`/files${request.nextUrl.pathname}`, request.url)
    return NextResponse.rewrite(previewPage)
  }

  return clerk(request, event)
}

// The preview pages have a host of their own when FILES_PREVIEW_URL has no path (https://files.usepersona.dev). With a path (https://example.com/files) they sit under the app's own address, and the app serves them with no rewrite
function isPreviewHost(hostname: string) {
  const hasOwnHost = FILES_PREVIEW.pathname === "/"
  return hasOwnHost && hostname === FILES_PREVIEW.hostname
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}
