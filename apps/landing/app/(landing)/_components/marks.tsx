import type { LucideIcon } from "lucide-react"
import Image from "next/image"

import { APP_NAMES, CHANNELS, type AppId, type ChannelId } from "../_lib/content"

// The painted cloud of the logo; CSS sets its size where it sits
export function Mark() {
  return <Image src="/brand/mark.webp" alt="" width={40} height={40} />
}

// An app's logo (the same files the app's Integrations tab shows), drawn as a background so CSS sizes and rounds it
export function AppLogo({ app, size }: { app: AppId; size: number }) {
  return <i className={`alogo al-${app}`} style={{ width: size, height: size }} role="img" aria-label={APP_NAMES[app]} />
}

// A chat app's icon, as the app's Channels tab draws it
export function ChannelIcon({ channel, size }: { channel: ChannelId; size: number }) {
  return <i className={`ch ch-${channel}`} style={{ width: size, height: size }} role="img" aria-label={CHANNELS.find((item) => item.id === channel)?.name} />
}

// A lucide icon with the page's "i" class, which keeps it from shrinking in a row
export function Icon({ of: Of, size = 16, stroke = 2 }: { of: LucideIcon; size?: number; stroke?: number }) {
  return <Of className="i" size={size} strokeWidth={stroke} aria-hidden />
}
