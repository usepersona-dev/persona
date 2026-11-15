"use client"

import { useState } from "react"

import { useAutomationSuggestions } from "@/hooks/automations"

const PAGE = 12

// The automations hub's list: the suggested automations, narrowed by the search, 12 at a time. A new search starts again from the first 12.
export function useAutomationsHub() {
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const shelf = useAutomationSuggestions()
  const words = query.trim().toLowerCase()
  const suggestions = shelf.suggestions?.filter((suggestion) => `${suggestion.name} ${suggestion.description}`.toLowerCase().includes(words))
  const shown = suggestions?.slice(0, limit)

  function changeQuery(value: string) {
    setQuery(value)
    setLimit(PAGE)
  }

  function loadMore() {
    setLimit(limit + PAGE)
  }

  return { query, changeQuery, total: shelf.suggestions?.length, suggestions, shown, error: shelf.error, isLoading: shelf.isLoading, hasMore: (suggestions?.length ?? 0) > limit, loadMore }
}
