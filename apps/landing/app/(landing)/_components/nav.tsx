"use client"

import { Menu } from "lucide-react"
import { useEffect } from "react"

import { useScrolledPast } from "../_hooks/use-scrolled-past"
import { APP, DOCS, GITHUB, HOW_LINKS, SIGN_UP } from "../_lib/content"
import { Icon, Mark } from "./marks"

// The top bar: nothing behind it at the top of the page, then a slim paper bar once the page scrolls. Both hold the logo, Start free and the menu.
export function Nav() {
  const scrolled = useScrolledPast(72)

  // A menu closes on one of its links, a click anywhere else, or Escape
  useEffect(() => {
    function shut(keep: Element | null) {
      document.querySelectorAll("details.mnu[open]").forEach((menu) => menu !== keep && menu.removeAttribute("open"))
    }
    function onClick(event: MouseEvent) {
      const target = event.target as Element
      const menu = target.closest(".mnu")
      shut(menu && !target.closest(".drop a") ? menu : null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") shut(null)
    }
    document.addEventListener("click", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("click", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <>
      <header className="nav">
        <BarContent />
      </header>
      <div className={scrolled ? "slimbar on" : "slimbar"} inert={!scrolled}>
        <BarContent />
      </div>
    </>
  )
}

function BarContent() {
  return (
    <>
      <a className="logo" href="#top" aria-label="Persona home">
        <Mark />
        persona
      </a>
      <div className="end">
        <a className="btn sm" href={SIGN_UP}>
          Start free
        </a>
        <details className="mnu">
          <summary aria-label="Menu">
            <Icon of={Menu} size={22} />
          </summary>
          <div className="drop">
            <span className="drop-label">How to</span>
            {HOW_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            <hr />
            <a href="#questions">Questions</a>
            <a href={DOCS}>Docs</a>
            <a href={GITHUB}>Source code</a>
            <a href={APP}>Sign in</a>
          </div>
        </details>
      </div>
    </>
  )
}
