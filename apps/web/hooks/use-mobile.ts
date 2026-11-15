import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile() {
  const isMobile = React.useSyncExternalStore(subscribe, readIsMobile, readIsMobileOnServer)
  return isMobile
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)

  return () => query.removeEventListener("change", onChange)
}

function readIsMobile() {
  const query = window.matchMedia(MOBILE_QUERY)
  return query.matches
}

function readIsMobileOnServer() {
  return false
}
