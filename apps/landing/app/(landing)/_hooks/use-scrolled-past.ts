import { useSyncExternalStore } from "react"

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true })
  return () => window.removeEventListener("scroll", onChange)
}

// True once the page has scrolled more than `offset` pixels; false on the server
export function useScrolledPast(offset: number) {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > offset,
    () => false
  )
}
