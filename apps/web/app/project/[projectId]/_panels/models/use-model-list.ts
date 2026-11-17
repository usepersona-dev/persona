"use client"

import { useState } from "react"

import { useModels, type Model, type Persona } from "@/hooks/personas"

const PAGE = 10

// The orders of the list. A model the gateway gives no number for goes last.
export const SORTS: { value: string; label: string; key: (model: Model) => number }[] = [
  { value: "newest", label: "Newest", key: (model) => (model.released === null ? Infinity : -model.released) },
  { value: "cheapest", label: "Cheapest", key: (model) => (model.input === null || model.output === null ? Infinity : model.input + model.output) },
]

// The models page's list: the models that can run a persona (they use tools), the ones it runs on with when to use each, and the search, provider, order and paging they show by
export function useModelList(persona: Persona) {
  const [query, setQuery] = useState("")
  const [provider, setProvider] = useState("")
  const [sort, setSort] = useState("newest")
  const [limit, setLimit] = useState(PAGE)
  const { models, error, isLoading } = useModels()
  const runnable = models ?? []
  const defaultModel = runnable.find((model) => model.default)

  const counts = Map.groupBy(runnable, (model) => model.provider)
  const providers = [{ value: "", label: "All providers", count: runnable.length }, ...[...counts.keys()].sort().map((name) => ({ value: name, label: name, count: counts.get(name)?.length }))]
  const order = SORTS.find((item) => item.value === sort) ?? SORTS[0]
  const words = query.trim().toLowerCase()
  const matches = runnable.filter((model) => (!provider || model.provider === provider) && (model.name.toLowerCase().includes(words) || model.id.includes(words))).sort((first, second) => compare(order.key(first), order.key(second)))
  const shown = matches.slice(0, limit)
  const total = Math.floor(runnable.length / 10) * 10

  const catalog = new Map<string, Model>(runnable.map((model) => [model.id, model]))
  const bundle = persona.models
    .filter((option) => catalog.has(option.model))
    .map((option) => ({ model: catalog.get(option.model)!, when: option.when }))
  const selected = new Set(persona.models.map((option) => option.model))

  function loadMore() {
    setLimit(limit + PAGE)
  }

  function clear() {
    setQuery("")
    setProvider("")
  }

  return { models, error, isLoading, defaultModel, bundle, selected, providers, matches, shown, hasMore: matches.length > limit, total, query, setQuery, provider, setProvider, sort, setSort, loadMore, clear }
}

// Infinity marks a missing number, so two missing ones are equal
function compare(first: number, second: number) {
  if (first === second) return 0
  return first - second
}
