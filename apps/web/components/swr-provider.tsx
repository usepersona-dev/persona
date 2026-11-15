"use client"

import { SWRConfig } from "swr"

import { fetcher } from "@/lib/api-client"

// Url-as-key: every useSWR key is the API path it reads, and api-client's fetcher is the one place the fetch happens
export function SwrProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ fetcher }}>{children}</SWRConfig>
}
