import type { Instrumentation } from "next"

// Reports the server errors Next catches (renders, server actions, the proxy) to PostHog, as the visitor who made the request
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { reportError, visitorOf } = await import("@/lib/posthog")
  const visitor = visitorOf([request.headers.cookie ?? []].flat().join("; "))
  await reportError(error, visitor, { path: request.path, method: request.method, routerKind: context.routerKind, routeType: context.routeType })
}
