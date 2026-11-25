"use client"

import { Avatar as DiceAvatar, Style } from "@dicebear/core"
import adventurerNeutral from "@dicebear/styles/adventurer-neutral.json"
import avataaars from "@dicebear/styles/avataaars.json"
import botttsNeutral from "@dicebear/styles/bottts-neutral.json"
import clay from "@dicebear/styles/clay.json"
import critters from "@dicebear/styles/critters.json"
import funEmoji from "@dicebear/styles/fun-emoji.json"
import gaze from "@dicebear/styles/gaze.json"
import initialFace from "@dicebear/styles/initial-face.json"
import lorelei from "@dicebear/styles/lorelei.json"
import micah from "@dicebear/styles/micah.json"
import moods from "@dicebear/styles/moods.json"
import notionistsNeutral from "@dicebear/styles/notionists-neutral.json"
import personas from "@dicebear/styles/personas.json"
import pixelArt from "@dicebear/styles/pixel-art.json"
import pixelbot from "@dicebear/styles/pixelbot.json"
import sprouts from "@dicebear/styles/sprouts.json"
import thumbs from "@dicebear/styles/thumbs.json"
import voxelArt from "@dicebear/styles/voxel-art.json"
import voxelBot from "@dicebear/styles/voxel-bot.json"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"

// The DiceBear faces a persona wears when it has no picture of its own. The store holds the one picked.
const PERSONA_STYLES = {
  "bottts-neutral": new Style(botttsNeutral),
  "adventurer-neutral": new Style(adventurerNeutral),
  avataaars: new Style(avataaars),
  "notionists-neutral": new Style(notionistsNeutral),
  "fun-emoji": new Style(funEmoji),
  personas: new Style(personas),
  lorelei: new Style(lorelei),
  micah: new Style(micah),
  thumbs: new Style(thumbs),
  "pixel-art": new Style(pixelArt),
  gaze: new Style(gaze),
  pixelbot: new Style(pixelbot),
  "voxel-bot": new Style(voxelBot),
  "voxel-art": new Style(voxelArt),
  clay: new Style(clay),
  critters: new Style(critters),
  moods: new Style(moods),
  sprouts: new Style(sprouts),
  "initial-face": new Style(initialFace),
}

export type PersonaStyle = keyof typeof PERSONA_STYLES

export const PERSONA_STYLE_IDS = Object.keys(PERSONA_STYLES) as PersonaStyle[]

export function personaAvatarUri(style: PersonaStyle, name: string) {
  const uri = new DiceAvatar<unknown>(PERSONA_STYLES[style], { seed: name, animation: true }).toDataUri()
  return uri
}

export function PersonaAvatar({ name, imageUrl, className }: { name: string; imageUrl?: string | null; className?: string }) {
  const style = useStore((state) => state.personaStyle)
  const src = imageUrl ?? personaAvatarUri(style, name)

  return (
    <Avatar className={className}>
      <AvatarImage src={src} alt="" />
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
