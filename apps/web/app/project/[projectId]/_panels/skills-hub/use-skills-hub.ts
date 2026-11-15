"use client"

import { useState } from "react"
import { useDebouncedCallback } from "use-debounce"

import { useMarketplaceSkills, useSkills } from "@/hooks/skills"

const PAGE = 10
const WAIT = 350

// The skills hub's list: skills.sh's skills, searched once the typing stops. Under two letters it shows skills.sh's most installed skills.
// Each search loads on its own, so its rows never show under another search; one done before comes back at once. busy covers the typing and a search's loading; the first load has its skeleton.
// It shows 10 at a time, and marks the ones the persona installed, by their skills.sh id: two publishers can both have a skill named pdf.
export function useSkillsHub(personaId: string) {
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const own = useSkills(personaId)
  const hub = useMarketplaceSkills(search)
  const installedIds = new Set(own.skills?.map((skill) => skill.origin.id))
  const skills = hub.skills?.map((skill) => ({ ...skill, installed: installedIds.has(skill.id) }))
  const shown = skills?.slice(0, limit)
  const typing = searchFor(query) !== search
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(searchFor(value))
    setLimit(PAGE)
  }, WAIT)

  function changeQuery(value: string) {
    setQuery(value)
    debouncedSearch(value)
  }

  function clear() {
    debouncedSearch.cancel()
    setQuery("")
    setSearch("")
    setLimit(PAGE)
  }

  function loadMore() {
    setLimit(limit + PAGE)
  }

  return { query, changeQuery, clear, search, skills, shown, error: hub.error, isLoading: hub.isLoading, busy: typing || (hub.isLoading && search !== ""), hasMore: (skills?.length ?? 0) > limit, loadMore }
}

// 1 install, 950 installs, 12K installs
export function installs(count: number) {
  if (count === 1) return "1 install"
  const compact = new Intl.NumberFormat("en", { notation: "compact" }).format(count)
  return `${compact} installs`
}

// What skills.sh is asked for: nothing under two letters, which gives its most installed skills
function searchFor(value: string) {
  const words = value.trim()
  if (words.length < 2) return ""
  return words
}
