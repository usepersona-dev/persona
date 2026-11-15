"use client"

import { useEffect } from "react"

// Keeps the open project's id in the "project" cookie, so the app's root (/) opens it next time. The browser sets it, as shadcn's sidebar does with its own cookie.
export function useLastProject(projectId: string) {
  useEffect(() => {
    document.cookie = `project=${projectId}; path=/; max-age=31536000; samesite=lax`
  }, [projectId])
}
