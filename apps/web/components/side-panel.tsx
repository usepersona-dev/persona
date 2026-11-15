"use client"

import { XIcon } from "lucide-react"
import Image from "next/image"
import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// A panel that slides in over the page from the end side, for what the URL opens (the persona panel).
// It is not modal and not a dialog: the page behind stays usable, a click outside or Esc does not close it, and a dialog opened inside it is a plain dialog.
// A panel opened inside another stacks on top: the one under it recedes up and to the side, one step for each panel over it, so a third panel shows three layers.
// It sits on document.body, clear of the panel under it, and each step back is one layer lower, so the order on the page never matters. It slides in with @starting-style, and slides out before it unmounts.
//
// The head: the title and the actions in one row, across the panel.
//
//   <SidePanel open={open} onOpenChange={onOpenChange}>
//     <SidePanelHeader>
//       <SidePanelTitle>Nadia</SidePanelTitle>
//       <SidePanelActions>
//         <SidePanelClose />
//       </SidePanelActions>
//     </SidePanelHeader>
//     <SidePanelBody>…</SidePanelBody>
//   </SidePanel>

// `open` follows the live value and `data` keeps the last one, so a panel still has content while it slides out
function usePanelState<T>(live: T | null | undefined) {
  const [last, setLast] = useState(live)
  const present = live !== null && live !== undefined
  if (present && live !== last) setLast(live)
  return { open: present, data: live ?? last }
}

// A panel inside another tells the one under it how many panels are open over it, itself counted
const PanelStack = createContext<((depth: number) => void) | null>(null)

// What the title and Close need from their panel
const PanelParts = createContext<{ titleId: string; close: () => void } | null>(null)

const subscribe = () => () => {}

function SidePanel({ open, onOpenChange, className, children }: { open: boolean; onOpenChange: (open: boolean) => void; className?: string; children: React.ReactNode }) {
  const stack = useContext(PanelStack)
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const browser = useSyncExternalStore(subscribe, () => true, () => false)
  const [mounted, setMounted] = useState(open)
  const [depth, setDepth] = useState(0)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    stack?.(open ? depth + 1 : 0)
    return () => stack?.(0)
  }, [stack, open, depth])

  // Focus moves into the panel when it opens, and back to where it was when it closes
  useEffect(() => {
    if (!open) return
    const before = document.activeElement
    panel.current?.focus({ preventScroll: true })
    return () => {
      if (before instanceof HTMLElement) before.focus({ preventScroll: true })
    }
  }, [open])

  function unmount(event: React.TransitionEvent) {
    if (open || event.target !== event.currentTarget) return
    setMounted(false)
  }

  if (!mounted || !browser) return null

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-slot="side-panel"
      data-closed={open ? undefined : ""}
      data-stacked={depth > 0 || undefined}
      style={{ "--depth": depth } as React.CSSProperties}
      onTransitionEnd={unmount}
      className={cn(
        "@container fixed inset-x-0 top-12 bottom-0 isolate z-40 flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[translate,scale,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none starting:translate-x-10 starting:opacity-0 data-closed:pointer-events-none data-closed:translate-x-10 data-closed:opacity-0 data-closed:duration-200 md:start-auto md:top-auto md:h-[96dvh] md:w-[60vw] md:origin-bottom-right md:rounded-ss-xl md:border-s md:border-t md:shadow-2xl data-stacked:pointer-events-none data-stacked:z-[calc(40_-_var(--depth))] md:data-stacked:translate-x-[calc(var(--depth)_*_-3.5rem)] md:data-stacked:translate-y-[calc(var(--depth)_*_1rem)] md:data-stacked:scale-[calc(1_-_var(--depth)_*_0.025)] rtl:starting:-translate-x-10 rtl:data-closed:-translate-x-10",
        className
      )}
    >
      <SidePanelCorners />
      <PanelStack.Provider value={setDepth}>
        <PanelParts.Provider value={{ titleId, close: () => onOpenChange(false) }}>{children}</PanelParts.Provider>
      </PanelStack.Provider>
    </div>,
    document.body
  )
}

// Orchard: a vine down the top-right edge, a tree bottom-left and a blossom tree bottom-right, behind the content and cut by the panel's edges. The top-left corner stays free for the head's title.
// Each one needs the margin beside a 34rem column, so it shows only on a panel wide enough to keep it 16px clear of that column.
function SidePanelCorners({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden data-slot="side-panel-corners" className={cn("pointer-events-none absolute inset-0 -z-10 select-none", className)} {...props}>
      <Image src="/art/corners/vine-side.webp" alt="" loading="eager" width={88} height={77} className="absolute top-[58px] right-0 hidden @min-[752px]:block" />
      <Image src="/art/corners/tree.webp" alt="" loading="eager" width={121} height={150} className="absolute bottom-0 -left-9 hidden @min-[746px]:block" />
      <Image src="/art/corners/blossom-tree.webp" alt="" loading="eager" width={87} height={128} className="absolute right-0.5 bottom-0 hidden @min-[754px]:block" />
    </div>
  )
}

// A floating head sits over the body, so the body scrolls the panel's whole height and nothing is cut under a fixed strip; give that body pt-14
function SidePanelHeader({ floating, className, ...props }: React.ComponentProps<"div"> & { floating?: boolean }) {
  return <div data-slot="side-panel-header" className={cn("flex shrink-0 items-start gap-3 px-6 pt-5 pb-1", floating && "pointer-events-none absolute inset-x-0 top-0 z-10 *:data-[slot=side-panel-actions]:pointer-events-auto", className)} {...props} />
}

function SidePanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const parts = useContext(PanelParts)
  return <h2 id={parts?.titleId} data-slot="side-panel-title" className={cn("min-w-0 flex-1 truncate font-heading text-2xl leading-tight font-semibold", className)} {...props} />
}

function SidePanelDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="side-panel-description" className={cn("mt-1 truncate text-sm font-semibold text-foreground/80", className)} {...props} />
}

function SidePanelActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="side-panel-actions" className={cn("ms-auto flex shrink-0 items-center gap-1.5", className)} {...props} />
}

function SidePanelClose({ className, ...props }: React.ComponentProps<typeof Button>) {
  const parts = useContext(PanelParts)

  return (
    <Button data-slot="side-panel-close" variant="outline" size="icon-sm" onClick={parts?.close} className={className} {...props}>
      <XIcon />
      <span className="sr-only">Close</span>
    </Button>
  )
}

function SidePanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="side-panel-body" className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", className)} {...props} />
}

export { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelDescription, SidePanelHeader, SidePanelTitle, usePanelState }
