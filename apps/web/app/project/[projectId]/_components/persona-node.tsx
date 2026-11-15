"use client"

import type { NodeProps } from "@xyflow/react"

import { PersonaAvatar } from "@/components/persona-avatar"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"

import { usePanels } from "../_hooks/use-panels"
import type { PersonaFlowNode } from "../_hooks/use-persona-nodes"

export function PersonaNode({ id, data, selected }: NodeProps<PersonaFlowNode>) {
  const panels = usePanels()

  return (
    <ContextMenu>
      <ContextMenuTrigger className="group flex flex-col items-center gap-1.5">
        <PersonaAvatar name={data.name} imageUrl={data.imageUrl} className="size-24 rounded-3xl transition-transform duration-200 group-hover:-translate-y-1" />
        <span data-slot="node-label" className={cn("max-w-[172px] truncate rounded-md px-[11px] py-[5px] text-[12.5px] leading-tight font-bold", selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
          {data.name}
        </span>
      </ContextMenuTrigger>
      {/* The menu sits in a portal, but React still bubbles its clicks to the node, where React Flow's node click would open the persona's panel in place of the one picked */}
      <ContextMenuContent className="w-40" onClick={(event) => event.stopPropagation()}>
        <ContextMenuItem onClick={() => panels.openPersona(id, "settings")}>Settings</ContextMenuItem>
        <ContextMenuItem onClick={() => panels.openDuplicate(id)}>Duplicate</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
