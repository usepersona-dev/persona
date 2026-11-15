"use client"

import "@xyflow/react/dist/base.css"

import { ReactFlow, ReactFlowProvider, useNodesState, useReactFlow } from "@xyflow/react"
import { CloudOffIcon, UsersIcon } from "lucide-react"
import { useEffect } from "react"

import { ScreenEmpty } from "@/components/screen"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useStore } from "@/lib/store"

import { useCanvasHistory } from "../_hooks/use-canvas-history"
import { useLastProject } from "../_hooks/use-last-project"
import { usePanels } from "../_hooks/use-panels"
import { usePersonaNodes, type PersonaFlowNode } from "../_hooks/use-persona-nodes"
import { FIT_VIEW, gridPosition, layout } from "../_lib/layout"
import { ProjectPanels } from "../_panels/project-panels"
import { CanvasControls } from "./canvas-controls"
import { PersonaNode } from "./persona-node"

const NODE_TYPES = { persona: PersonaNode }
const NODE_ORIGIN: [number, number] = [0.5, 0]

// The panels sit beside the canvas, not in it: a drag re-renders the canvas on every move, and the open panel would re-render with it
export function ProjectCanvas({ projectId }: { projectId: string }) {
  useLastProject(projectId)

  return (
    <ReactFlowProvider>
      <Canvas projectId={projectId} />
      <ProjectPanels projectId={projectId} />
    </ReactFlowProvider>
  )
}

// The project's personas. The canvas holds the nodes, so a drag re-renders it on every move, and React Flow redraws only the persona that moves.
// A persona stays where it was left (saved in this browser). On load, one never moved takes its place in the grid; one added while the canvas is open lands in the middle of the view.
// The open persona lives in the URL through usePanels, so the sidebar and the canvas agree, and Back closes it.
function Canvas({ projectId }: { projectId: string }) {
  const { personaNodes, isEmpty, error, isLoading } = usePersonaNodes(projectId)
  const panels = usePanels()
  const savePositions = useStore((state) => state.saveCanvasPositions)
  const [nodes, setNodes, onNodesChange] = useNodesState<PersonaFlowNode>([])
  const { fitView, screenToFlowPosition, getNode, getZoom, setCenter } = useReactFlow()
  const history = useCanvasHistory(nodes, setNodes)

  // An opened persona glides to the middle of the canvas the panel leaves free. From md up the panel covers 60vw, so the middle moves 30vw to the left.
  useEffect(() => {
    const node = panels.persona ? getNode(panels.persona) : undefined
    if (!node || !window.matchMedia("(min-width: 48rem)").matches) return
    const zoom = getZoom()
    void setCenter(node.position.x + (window.innerWidth * 0.3) / zoom, node.position.y + (node.measured?.height ?? 0) / 2, { zoom, duration: 400 })
  }, [panels.persona, getNode, getZoom, setCenter])

  useEffect(() => {
    setNodes((current) => {
      const placed = new Map(current.map((node) => [node.id, node]))
      const saved = useStore.getState().canvasPositions
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      const merged = personaNodes.map((node, index) => {
        const existing = placed.get(node.id)
        const fallback = placed.size > 0 ? center : gridPosition(index, personaNodes.length)
        const next = { ...(existing ?? node), position: existing?.position ?? saved[node.id] ?? fallback, data: node.data, selected: node.id === panels.persona }
        return next
      })
      return merged
    })
  }, [personaNodes, panels.persona, setNodes, screenToFlowPosition])

  useEffect(() => {
    if (nodes.length === 0) return
    const timer = setTimeout(() => savePositions(Object.fromEntries(nodes.map((node) => [node.id, node.position]))), 300)
    return () => clearTimeout(timer)
  }, [nodes, savePositions])

  function closePanel() {
    if (!panels.panelOpen) return
    panels.close()
  }

  function discover(event: MouseEvent | React.MouseEvent) {
    event.preventDefault()
    panels.openDiscover()
  }

  function autoLayout() {
    history.snapshot()
    setNodes(layout)
    fitView({ ...FIT_VIEW, duration: 200 })
  }

  return (
    <div data-slot="canvas" className="relative min-h-0 w-full flex-1">
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          nodeTypes={NODE_TYPES}
          nodeOrigin={NODE_ORIGIN}
          onNodesChange={onNodesChange}
          onNodeDragStart={history.snapshot}
          onNodeClick={(_, node) => panels.openPersona(node.id)}
          onPaneClick={closePanel}
          onPaneContextMenu={discover}
          nodesConnectable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          panOnScroll
          fitView
          fitViewOptions={FIT_VIEW}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <CanvasControls history={history} onLayout={autoLayout} />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            {isLoading && <CanvasSkeleton />}
            {error && (
              <ScreenEmpty role="alert" className="pointer-events-auto max-w-sm">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                    <CloudOffIcon />
                  </EmptyMedia>
                  <EmptyTitle>Your personas did not load</EmptyTitle>
                  <EmptyDescription>{error.message}</EmptyDescription>
                </EmptyHeader>
              </ScreenEmpty>
            )}
            {isEmpty && (
              <ScreenEmpty className="pointer-events-auto max-w-sm">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersIcon />
                  </EmptyMedia>
                  <EmptyTitle>No personas yet</EmptyTitle>
                  <EmptyDescription>The personas you create show up here.</EmptyDescription>
                </EmptyHeader>
              </ScreenEmpty>
            )}
          </div>
        </ReactFlow>
      </div>
    </div>
  )
}

// Four nodes in the default 2×2 grid while the personas load
function CanvasSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-x-26 gap-y-11">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex flex-col items-center gap-1.5">
          <Skeleton className="size-24 rounded-3xl" />
          <Skeleton className="h-6 w-24 rounded-sm" />
        </div>
      ))}
    </div>
  )
}
