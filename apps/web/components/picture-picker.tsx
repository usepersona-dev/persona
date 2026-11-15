"use client"

import { CameraIcon, ImagePlusIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

type Props = { picture?: React.ReactNode; cover: string; label: string; note: string; uploading?: boolean; removing?: boolean; onPick: (file: File) => void; onRemove?: () => void; className?: string }

// A picture that is its own upload button: a camera badge on it, and a dark cover with `cover` under the pointer. With no picture, a dashed shape with a plus is the button.
// Beside it: `note` (what selecting it does), the file rules, and a small red Remove when `onRemove` is given. Only a PNG, JPG, WebP or GIF up to 2 MB reaches `onPick`. `className` gives the shape its corners.
export function PicturePicker({ picture, cover, label, note, uploading = false, removing = false, onPick, onRemove, className }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const busy = uploading || removing

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!PICTURE_TYPES.includes(file.type)) return toast.add({ title: "Pick a PNG, JPG, WebP or GIF picture.", type: "error" })
    if (file.size > 2 * 1024 * 1024) return toast.add({ title: "Pictures can be up to 2 MB.", type: "error" })
    onPick(file)
  }

  return (
    <div data-slot="picture-picker" className="flex items-center gap-4">
      <button type="button" aria-label={label} disabled={busy} onClick={() => input.current?.click()} className={cn("group/picture relative size-16 shrink-0 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default", className)}>
        {picture ?? (
          <span className="flex size-full items-center justify-center rounded-[inherit] border border-dashed border-foreground/25 bg-muted/40 text-muted-foreground transition-colors group-hover/picture:border-foreground/40 group-hover/picture:text-foreground">
            <ImagePlusIcon className="size-5" />
          </span>
        )}
        {picture && !busy && (
          <>
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-[inherit] bg-black/50 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover/picture:opacity-100 group-focus-visible/picture:opacity-100">
              <CameraIcon className="size-4" />
              {cover}
            </span>
            <span className="absolute -end-1 -bottom-1 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-opacity group-hover/picture:opacity-0">
              <CameraIcon className="size-3.5" />
            </span>
          </>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/70">
            <Spinner />
          </span>
        )}
      </button>
      <input ref={input} type="file" accept={PICTURE_TYPES.join(",")} tabIndex={-1} className="hidden" onChange={choose} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm">{uploading ? "Uploading…" : note}</p>
        <p className="text-xs text-muted-foreground/70">PNG, JPG, WebP or GIF, up to 2 MB.</p>
        {onRemove && (
          <Button type="button" variant="link" disabled={busy} onClick={onRemove} className="h-auto self-start p-0 text-xs text-destructive">
            {removing ? "Removing…" : "Remove"}
          </Button>
        )}
      </div>
    </div>
  )
}
