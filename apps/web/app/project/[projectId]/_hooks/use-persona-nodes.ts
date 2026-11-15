"use client"

import type { Node } from "@xyflow/react"
import { useMemo } from "react"

import { usePersonas } from "@/hooks/personas"

export type PersonaFlowNode = Node<{ name: string; imageUrl: string | null }, "persona">

// The project's personas as canvas nodes. Where they sit is the canvas's job, so each starts at 0,0.
// A dragged node rides above the others, so the cursor never hovers (and lifts) the faces it passes over.
export function usePersonaNodes(projectId: string) {
  const { personas, error, isLoading } = usePersonas(projectId)

  const personaNodes = useMemo(() => {
    const nodes = (personas ?? []).map((persona): PersonaFlowNode => ({ id: persona.id, type: "persona", position: { x: 0, y: 0 }, data: { name: persona.name, imageUrl: persona.imageUrl }, className: "[&.dragging]:z-1000!" }))
    return nodes
  }, [personas])

  return { personaNodes, isEmpty: personas?.length === 0, error, isLoading }
}
