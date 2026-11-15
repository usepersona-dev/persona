"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"
import { useState } from "react"

import { Tabs, TabsContent } from "@/components/ui/tabs"

// Vercel's dashboard tabs: a pill slides to the tab under the pointer, and a line slides to the open tab.
// Only the strip is new. Tabs and TabsContent are the stock ones, so a page changes the import and nothing else.
//
//   <Tabs value={value} onValueChange={setValue}>
//     <TabsList>
//       <TabsTrigger value="overview">Overview</TabsTrigger>
//       <TabsTrigger value="usage">Usage</TabsTrigger>
//     </TabsList>
//     <TabsContent value="overview">…</TabsContent>
//   </Tabs>

// The pill keeps its place when the pointer leaves: it fades out there, and the next hover slides it from there.
// Its first move starts from `left: auto`, which does not animate, so on the first hover it fades in where it lands.
function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  const [hover, setHover] = useState<React.CSSProperties>()

  function showHover(event: React.PointerEvent) {
    const tab = (event.target as Element).closest<HTMLElement>("[data-slot=tabs-trigger]")
    if (!tab || event.pointerType === "touch") return
    setHover({ left: tab.offsetLeft, top: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight, opacity: 1 })
  }

  function hideHover() {
    setHover((hover) => ({ ...hover, opacity: 0 }))
  }

  return (
    <TabsPrimitive.List data-slot="tabs-list" className={cn("relative flex items-center gap-1.5 pb-1.5", className)} onPointerOver={showHover} onPointerLeave={hideHover} {...props}>
      <span aria-hidden data-slot="tabs-hover" className="absolute rounded-md bg-muted opacity-0 transition-[left,width,opacity] duration-300 ease-out dark:bg-muted/50" style={hover} />
      {children}
      <TabsPrimitive.Indicator data-slot="tabs-indicator" className="absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) bg-foreground transition-[translate,width] duration-300 ease-out" />
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return <TabsPrimitive.Tab data-slot="tabs-trigger" className={cn("relative inline-flex h-7.5 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-300 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-active:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50", className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
