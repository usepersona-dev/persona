"use client"

import type { Node } from "@xyflow/react"
import { useState } from "react"

import type { CanvasPositions } from "@/lib/store"

// Undo and redo for where the personas sit. The canvas takes a snapshot before each move; undo puts the last one back.
export function useCanvasHistory<N extends Node>(nodes: N[], setNodes: (update: (current: N[]) => N[]) => void) {
  const [past, setPast] = useState<CanvasPositions[]>([])
  const [future, setFuture] = useState<CanvasPositions[]>([])

  function positions() {
    const current: CanvasPositions = Object.fromEntries(nodes.map((node) => [node.id, { ...node.position }]))
    return current
  }

  function move(saved: CanvasPositions) {
    setNodes((current) => current.map((node) => (saved[node.id] ? { ...node, position: saved[node.id] } : node)))
  }

  function snapshot() {
    setPast((entries) => [...entries, positions()].slice(-50))
    setFuture([])
  }

  function undo() {
    const previous = past.at(-1)
    if (!previous) return
    setPast((entries) => entries.slice(0, -1))
    setFuture((entries) => [...entries, positions()])
    move(previous)
  }

  function redo() {
    const next = future.at(-1)
    if (!next) return
    setFuture((entries) => entries.slice(0, -1))
    setPast((entries) => [...entries, positions()])
    move(next)
  }

  return { snapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}
