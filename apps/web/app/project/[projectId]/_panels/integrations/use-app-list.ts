"use client"

import { useState } from "react"

import { useApps, useConnectedApps } from "@/hooks/integrations"

const PAGE = 50

// The integrations page's lists: the persona's connected accounts and the whole catalogue, both narrowed by the search. The catalogue shows 50 apps at a time.
export function useAppList(personaId: string) {
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const catalog = useApps()
  const accounts = useConnectedApps(personaId)
  const error = catalog.error ?? accounts.error
  const words = query.trim().toLowerCase()
  const matches = (app: { name: string; toolkit: string }) => app.name.toLowerCase().includes(words) || app.toolkit.includes(words)
  const connected = accounts.apps?.filter(matches)
  const apps = catalog.apps?.filter(matches)
  const shownApps = apps?.slice(0, limit)
  const total = Math.floor((catalog.apps?.length ?? 0) / 100) * 100

  function loadMore() {
    setLimit(limit + PAGE)
  }

  return { query, setQuery, error, connected, isLoadingConnected: accounts.isLoading, apps, isLoadingApps: catalog.isLoading, shownApps, hasMore: (apps?.length ?? 0) > limit, total, loadMore }
}
