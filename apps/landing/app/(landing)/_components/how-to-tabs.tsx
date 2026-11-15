"use client"

import { useEffect, useRef, useState } from "react"

import { useReducedMotion } from "../_hooks/use-reduced-motion"

// The chapter index on the left and one chapter on the right; choosing a chapter swaps it in place. Arrow keys move between chapters.
// A link to #build, #sell or #scale (the menu) opens that chapter and brings the section into view.
export function HowToTabs({ chapters, panels, note }: { chapters: { id: string; short: string }[]; panels: React.ReactNode[]; note: string }) {
  const [at, setAt] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const still = useReducedMotion()

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element).closest("a[href^='#']")
      const index = link ? chapters.findIndex((chapter) => `#${chapter.id}` === link.getAttribute("href")) : -1
      if (index < 0) return
      event.preventDefault()
      setAt(index)
      document.getElementById("how")?.scrollIntoView({ behavior: still ? "auto" : "smooth" })
      history.replaceState(null, "", `#${chapters[index].id}`)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [chapters, still])

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + chapters.length) % chapters.length
    setAt(next)
    tabs.current[next]?.focus()
  }

  return (
    <div className="wrap guide tabbed">
      <div className="gindex">
        <div role="tablist" aria-label="Chapters" aria-orientation="vertical">
          {chapters.map((chapter, index) => (
            <button
              key={chapter.id}
              ref={(button) => {
                tabs.current[index] = button
              }}
              type="button"
              role="tab"
              id={`tab-${chapter.id}`}
              aria-controls={chapter.id}
              aria-selected={index === at}
              tabIndex={index === at ? 0 : -1}
              className={index === at ? "on" : undefined}
              onClick={() => setAt(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <i>{String(index + 1).padStart(2, "0")}</i>
              {chapter.short}
            </button>
          ))}
        </div>
        <p>{note}</p>
      </div>
      <div className="gpanels">
        {panels.map((panel, index) => (
          <article key={chapters[index].id} id={chapters[index].id} className="gchap" role="tabpanel" aria-labelledby={`tab-${chapters[index].id}`} tabIndex={0} hidden={index !== at}>
            {panel}
          </article>
        ))}
      </div>
    </div>
  )
}
