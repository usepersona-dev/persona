"use client"

import { useEffect, useRef, useState } from "react"

import { useReducedMotion } from "../_hooks/use-reduced-motion"

const STEP_MS = 4500

// The six steps over the app window: the chosen one shows its scene in the panel and its caption under the window.
// Without reduced motion, the next step comes every 4.5 s while the window is on screen; a click starts the count again.
export function InsideTabs({ steps, sidebar, canvas, scenes }: { steps: { label: string; caption: string }[]; sidebar: React.ReactNode; canvas: React.ReactNode; scenes: React.ReactNode[] }) {
  const [at, setAt] = useState(0)
  const [visible, setVisible] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()

  useEffect(() => {
    const node = stage.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (still || !visible) return
    const timer = setTimeout(() => setAt((current) => (current + 1) % steps.length), STEP_MS)
    return () => clearTimeout(timer)
  }, [at, still, visible, steps.length])

  return (
    <>
      <div className="seg" role="tablist" aria-label="What you do in Persona">
        {steps.map((step, index) => (
          <button key={step.label} type="button" role="tab" aria-selected={index === at} className={index === at ? "on" : undefined} onClick={() => setAt(index)}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            {step.label}
            <span className="seg-fill" aria-hidden />
          </button>
        ))}
      </div>
      <div className="stage" ref={stage}>
        <div className="ui win">
          {sidebar}
          {canvas}
          <section className="panel">
            {scenes.map((scene, index) => (
              <div key={index} className={index === at ? "scene on" : "scene"}>
                {scene}
              </div>
            ))}
          </section>
        </div>
      </div>
      <p className="stage-cap" aria-live="polite">
        {steps[at].caption}
      </p>
    </>
  )
}
