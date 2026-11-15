"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { PersonaStyle } from "@/components/persona-avatar"
import type { ProjectStyle } from "@/components/project-avatar"

export type CanvasPositions = Record<string, { x: number; y: number }>

// Per-browser preferences, kept in localStorage
type Store = {
  projectStyle: ProjectStyle
  setProjectStyle: (style: ProjectStyle) => void
  personaStyle: PersonaStyle
  setPersonaStyle: (style: PersonaStyle) => void
  canvasPositions: CanvasPositions
  saveCanvasPositions: (positions: CanvasPositions) => void
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      projectStyle: "landscape",
      setProjectStyle: (style) => set({ projectStyle: style }),
      personaStyle: "voxel-bot",
      setPersonaStyle: (style) => set({ personaStyle: style }),
      canvasPositions: {},
      // Where the personas were dragged to, by persona id. Merged, never replaced: each canvas only saves its own personas.
      saveCanvasPositions: (positions) => set((state) => ({ canvasPositions: { ...state.canvasPositions, ...positions } })),
    }),
    { name: "persona:store" },
  ),
)
