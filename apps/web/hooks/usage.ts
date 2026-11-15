import useSWR from "swr"

import { fetcher, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as credits from "@/usecases/credits"

export type Usage = Output<typeof credits.listUsage>
export type UsageSpan = { from: string; to: string; unit: "hour" | "day"; timeZone: string }

// The organization's credits, charges and tokens in a span, per persona and per hour or day, with its personas
export function useUsage(span: UsageSpan) {
  const query = new URLSearchParams(span).toString()
  const { data, error, isLoading } = useSWR<Usage, ApiError>(`/api/usage?${query}`, fetcher)
  return { usage: data, error, isLoading }
}
