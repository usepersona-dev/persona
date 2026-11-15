import { useSyncExternalStore } from "react"

const REDUCE = "(prefers-reduced-motion: reduce)"

function subscribeReduce(onChange: () => void) {
  const query = window.matchMedia(REDUCE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false)
}
