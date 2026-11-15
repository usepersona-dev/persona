"use client"

import { useTheme } from "next-themes"
import { useMemo, useSyncExternalStore } from "react"

import { PERSONA_STYLE_IDS, personaAvatarUri } from "@/components/persona-avatar"
import { PROJECT_STYLE_IDS, projectAvatarUri } from "@/components/project-avatar"
import { ScreenDescription, ScreenGroup, ScreenHeader, ScreenTitle } from "@/components/screen"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const MODES = ["light", "system", "dark"] as const

// One made-up name shows every style
const PREVIEW_SEED = "Persona"

const subscribe = () => () => {}

// How Persona looks on this device, after GitHub: a part per choice, each a heading over a rule, then its tiles
export function Preferences() {
  const { theme, setTheme } = useTheme()
  const personaStyle = useStore((state) => state.personaStyle)
  const setPersonaStyle = useStore((state) => state.setPersonaStyle)
  const projectStyle = useStore((state) => state.projectStyle)
  const setProjectStyle = useStore((state) => state.setProjectStyle)
  // The server cannot read this browser's choices, so no tile is picked until the page runs in the browser
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  const personaPreviews = useMemo(() => PERSONA_STYLE_IDS.map((style) => ({ style, src: personaAvatarUri(style, PREVIEW_SEED) })), [])
  const projectPreviews = useMemo(() => PROJECT_STYLE_IDS.map((style) => ({ style, src: projectAvatarUri(style, PREVIEW_SEED) })), [])

  return (
    <>
      <ScreenHeader>
        <ScreenTitle>Preferences</ScreenTitle>
        <ScreenDescription>Choose how Persona looks for you.</ScreenDescription>
      </ScreenHeader>
      <ScreenGroup title="Color mode" description="Applies on this device.">
        <div role="radiogroup" aria-label="Color mode" className="flex flex-wrap gap-2">
          {MODES.map((mode) => (
            <Tile key={mode} label={mode} selected={hydrated && theme === mode} onSelect={() => setTheme(mode)}>
              <ModePreview mode={mode} />
            </Tile>
          ))}
        </div>
      </ScreenGroup>
      <ScreenGroup title="Persona faces" description="How every persona looks. Applies on this device.">
        <div role="radiogroup" aria-label="Persona faces" className="flex flex-wrap gap-2">
          {personaPreviews.map((preview) => (
            <Tile key={preview.style} label={preview.style.replaceAll("-", " ")} selected={hydrated && personaStyle === preview.style} onSelect={() => setPersonaStyle(preview.style)}>
              <Avatar className="size-11 rounded-lg">
                <AvatarImage src={preview.src} alt="" />
              </Avatar>
            </Tile>
          ))}
        </div>
      </ScreenGroup>
      <ScreenGroup title="Project pictures" description="For projects without a picture of their own. Applies on this device.">
        <div role="radiogroup" aria-label="Project pictures" className="flex flex-wrap gap-2">
          {projectPreviews.map((preview) => (
            <Tile key={preview.style} label={preview.style.replaceAll("-", " ")} selected={hydrated && projectStyle === preview.style} onSelect={() => setProjectStyle(preview.style)}>
              <Avatar className="size-11 rounded-md">
                <AvatarImage src={preview.src} alt="" />
              </Avatar>
            </Tile>
          ))}
        </div>
      </ScreenGroup>
    </>
  )
}

function Tile({ label, selected, onSelect, children }: { label: string; selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={label}
      onClick={onSelect}
      className={cn("flex w-19 flex-col items-center gap-1.5 rounded-xl p-1.5 text-xs font-bold capitalize outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", selected ? "bg-primary/10 text-foreground ring-2 ring-primary" : "text-muted-foreground hover:bg-muted")}
    >
      {children}
      <span className="w-full truncate text-center">{label}</span>
    </button>
  )
}

// A small window in each mode, in the sky's fixed colors, so the tiles look the same in either theme
function ModePreview({ mode }: { mode: (typeof MODES)[number] }) {
  return (
    <span className="flex size-11 overflow-hidden rounded-lg ring-1 ring-foreground/10">
      {mode !== "dark" && (
        <span className="flex flex-1 flex-col gap-1 bg-[#eef6fe] p-1.5">
          <span className="h-1.5 w-full rounded-full bg-white" />
          <span className="h-1.5 w-2/3 rounded-full bg-[#c3d6ef]" />
        </span>
      )}
      {mode !== "light" && (
        <span className="flex flex-1 flex-col gap-1 bg-[#0e1730] p-1.5">
          <span className="h-1.5 w-full rounded-full bg-[#15213d]" />
          <span className="h-1.5 w-2/3 rounded-full bg-[#33466f]" />
        </span>
      )}
    </span>
  )
}
