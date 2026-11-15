import type { FitViewOptions, Node } from "@xyflow/react"

const COLUMN_WIDTH = 176
const ROW_HEIGHT = 160

// Fit to screen stops at 100%, so one or two personas do not fill the whole canvas
export const FIT_VIEW: FitViewOptions = { padding: 0.3, maxZoom: 1 }

// A persona's place in the default grid. The grid is about as wide as it is tall: 4 personas make 2×2, 5 make 3 + 2.
// Positions are the top center of a node (the canvas uses nodeOrigin [0.5, 0]), so names of any length line up.
export function gridPosition(index: number, count: number) {
  const columns = Math.ceil(Math.sqrt(count))
  const position = { x: (index % columns) * COLUMN_WIDTH, y: Math.floor(index / columns) * ROW_HEIGHT }
  return position
}

// Every node in its place in the default grid
export function layout<N extends Node>(nodes: N[]) {
  const placed = nodes.map((node, index) => ({ ...node, position: gridPosition(index, nodes.length) }))
  return placed
}
