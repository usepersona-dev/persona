"use client"

import { Avatar as DiceAvatar, Style } from "@dicebear/core"
import glass from "@dicebear/styles/glass.json"
import identicon from "@dicebear/styles/identicon.json"
import initials from "@dicebear/styles/initials.json"
import landscape from "@dicebear/styles/landscape.json"
import rings from "@dicebear/styles/rings.json"
import shapeGrid from "@dicebear/styles/shape-grid.json"
import shapes from "@dicebear/styles/shapes.json"
import { cn } from "cn"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"

// The DiceBear styles a project wears when it has no picture of its own. The store holds the one picked.
const PROJECT_STYLES = {
  landscape: new Style(landscape),
  shapes: new Style(shapes),
  "shape-grid": new Style(shapeGrid),
  glass: new Style(glass),
  rings: new Style(rings),
  identicon: new Style(identicon),
  initials: new Style(initials),
}

export type ProjectStyle = keyof typeof PROJECT_STYLES

export const PROJECT_STYLE_IDS = Object.keys(PROJECT_STYLES) as ProjectStyle[]

export function projectAvatarUri(style: ProjectStyle, name: string) {
  const uri = new DiceAvatar<unknown>(PROJECT_STYLES[style], { seed: name }).toDataUri()
  return uri
}

export function ProjectAvatar({ name, imageUrl, className }: { name: string; imageUrl?: string | null; className?: string }) {
  const style = useStore((state) => state.projectStyle)
  const src = imageUrl ?? projectAvatarUri(style, name)

  return (
    <Avatar className={cn("rounded-md", className)}>
      <AvatarImage src={src} alt="" />
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
