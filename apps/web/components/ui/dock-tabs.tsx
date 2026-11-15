"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"
import { EllipsisVerticalIcon } from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type DockItem = { value: string; label: string; icon: React.ComponentType; divider?: boolean; more?: boolean }

// Tabs as a dock that floats at the bottom center of the nearest positioned parent (a panel). Every tab is an icon; the open one fills and opens out to show its name, and the others name themselves in a tooltip on hover.
// What does not fit goes behind More (⋮) at the end, whose menu opens upward, and so does every item marked `more`, at any width. A tab picked there joins the end of the row, or takes its last place when the row is full, so the open one is always in sight.
// It sits in the stock Tabs and takes the same value:
//
//   <Tabs value={value} onValueChange={setValue}>
//     <TabsContent value="rules">…</TabsContent>
//     <DockTabs items={items} value={value} onValueChange={setValue} />
//   </Tabs>

// To fit the row to the parent's width: an icon tab and its gap, what the open tab's name adds, and the dock's margins, padding and border.
const SLOT = 38
const NAME = 104
const EDGE = 40

const TAB = "group/tab flex h-9 shrink-0 items-center rounded-full px-2.5 text-muted-foreground transition-[background-color,color,padding] duration-300 ease-out outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-active:bg-foreground data-active:px-3.5 data-active:text-background data-active:hover:bg-foreground data-active:hover:text-background motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0"

function DockTabs({ items, value, onValueChange, className }: { items: DockItem[]; value: string; onValueChange: (value: string) => void; className?: string }) {
  const dock = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(items.length)
  const open = items.find((item) => item.value === value) ?? items[0]
  const forced = items.some((item) => item.more)
  const first = items.filter((item) => !item.more).slice(0, fit)
  const shown = first.includes(open) ? first : first.length < fit ? [...first, open] : [...first.slice(0, -1), open]
  const more = items.filter((item) => !shown.includes(item))

  useEffect(() => {
    const parent = dock.current?.offsetParent
    if (!parent) return
    const observer = new ResizeObserver(([entry]) => {
      const room = entry.contentRect.width - EDGE - NAME
      const all = !forced && items.length * SLOT <= room
      setFit(all ? items.length : Math.max(2, Math.floor((room - SLOT) / SLOT)))
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [items.length, forced])

  return (
    <TooltipProvider delay={250}>
      <TabsPrimitive.List ref={dock} data-slot="dock-tabs" className={cn("absolute inset-x-3 bottom-5 z-10 mx-auto flex w-fit items-center gap-0.5 rounded-full border bg-background/85 p-1.5 shadow-lg backdrop-blur", className)}>
        {shown.map((item, index) => (
          <Fragment key={item.value}>
            {item.divider && index > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />}
            <Tooltip disabled={item === open}>
              <TooltipTrigger render={<TabsPrimitive.Tab value={item.value} className={TAB} />}>
                <item.icon />
                <span className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity,margin] duration-300 ease-out group-data-active/tab:ms-2 group-data-active/tab:grid-cols-[1fr] group-data-active/tab:opacity-100 motion-reduce:transition-none">
                  <span className="overflow-hidden text-sm font-medium whitespace-nowrap">{item.label}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent sideOffset={10}>{item.label}</TooltipContent>
            </Tooltip>
          </Fragment>
        ))}
        {more.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" aria-label="More" className={TAB} />}>
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={12} className="min-w-52">
              <DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(String(next))}>
                {more.map((item, index) => (
                  <Fragment key={item.value}>
                    {item.divider && index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuRadioItem value={item.value} closeOnClick>
                      <item.icon />
                      {item.label}
                    </DropdownMenuRadioItem>
                  </Fragment>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TabsPrimitive.List>
    </TooltipProvider>
  )
}

export { DockTabs, Tabs, TabsContent }
