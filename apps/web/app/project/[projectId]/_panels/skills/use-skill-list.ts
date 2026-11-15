"use client"

import { useState } from "react"

import type { Persona } from "@/hooks/personas"
import { useSkills, type SkillSummary } from "@/hooks/skills"

// The skills page's list: the persona's skills, narrowed by the search as it is typed and by where they came from.
// The origin menu offers only the origins the persona's skills have, each with its count.
export function useSkillList(persona: Persona) {
  const [query, setQuery] = useState("")
  const [origin, setOrigin] = useState("")
  const { skills, error, isLoading } = useSkills(persona.id)
  const counts = Map.groupBy(skills ?? [], (skill) => skill.origin.kind)
  const kinds: { value: SkillSummary["origin"]["kind"]; label: string }[] = [
    { value: "custom", label: "Custom" },
    { value: "hub", label: "Hub" },
    { value: "agent", label: persona.name },
  ]
  const origins = [{ value: "", label: "All", count: skills?.length }, ...kinds.filter((kind) => counts.has(kind.value)).map((kind) => ({ ...kind, count: counts.get(kind.value)?.length }))]
  const words = query.trim().toLowerCase()
  const shown = skills?.filter((skill) => (!origin || skill.origin.kind === origin) && (skill.name.includes(words) || skill.description.toLowerCase().includes(words)))

  function clear() {
    setQuery("")
    setOrigin("")
  }

  return { query, setQuery, origin, setOrigin, origins, clear, skills, shown, error, isLoading }
}
