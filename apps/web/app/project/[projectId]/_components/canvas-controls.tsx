"use client"

import { Panel, useReactFlow } from "@xyflow/react"
import { LayoutGridIcon, MaximizeIcon, MinusIcon, PlusIcon, Redo2Icon, Undo2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { FIT_VIEW } from "../_lib/layout"

type History = { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }

// The canvas controls, bottom left: zoom, then undo and redo, then auto layout
export function CanvasControls({ history, onLayout }: { history: History; onLayout: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <Panel position="bottom-left" data-slot="canvas-controls" className="flex flex-col items-center gap-2">
      <ControlGroup>
        <ControlButton label="Zoom in" onClick={() => zoomIn({ duration: 200 })}>
          <PlusIcon />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={() => zoomOut({ duration: 200 })}>
          <MinusIcon />
        </ControlButton>
        <ControlButton label="Fit to screen" onClick={() => fitView({ ...FIT_VIEW, duration: 200 })}>
          <MaximizeIcon />
        </ControlButton>
      </ControlGroup>
      <ControlGroup>
        <ControlButton label="Undo" disabled={!history.canUndo} onClick={history.undo}>
          <Undo2Icon />
        </ControlButton>
        <ControlButton label="Redo" disabled={!history.canRedo} onClick={history.redo}>
          <Redo2Icon />
        </ControlButton>
      </ControlGroup>
      <ControlGroup>
        <ControlButton label="Auto layout" onClick={onLayout}>
          <LayoutGridIcon />
        </ControlButton>
      </ControlGroup>
    </Panel>
  )
}

function ControlGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-sidebar p-0.5">{children}</div>
}

function ControlButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={onClick} />}>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
