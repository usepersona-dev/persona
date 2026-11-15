import { Avatar, Style } from "@dicebear/core"
import clay from "@dicebear/styles/clay.json"

// Agent faces: DiceBear's Clay, as the app draws personas, still (no animation), on five soft grounds, with only the friendly mouths and eyes
const CLAY = new Style(clay)
const OPTIONS = {
  backgroundColor: ["dae9fb", "dff3e6", "fdf0d5", "fbe3df", "e9e4fb"],
  mouthVariant: ["smile", "grin", "smileBig", "cat", "uu", "smirk", "open", "laugh"],
  eyesVariant: ["googly", "even", "big", "dots", "happy", "wink", "side"],
} as const

const FACES = new Map<string, string>()

export function face(seed: string) {
  let uri = FACES.get(seed)
  if (!uri) {
    uri = new Avatar(CLAY, { seed, ...OPTIONS }).toDataUri()
    FACES.set(seed, uri)
  }
  return uri
}
