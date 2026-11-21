"use client"

import { CloudOffIcon } from "lucide-react"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton } from "@/components/screen"
import { Section, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import type { Persona } from "@/hooks/personas"
import { useTools, useUpdateTool, type ToolName, type Tools, type UpdateToolInput } from "@/hooks/tools"
import { cn } from "@/lib/utils"

const TOOLS: Record<ToolName, { label: string; line: string }> = {
  apps: { label: "Apps", line: "Work in the apps you connect." },
  automation: { label: "Automations", line: "Schedule tasks, once or on repeat." },
  browser: { label: "Browser", line: "Get things done on websites." },
  file: { label: "Files", line: "Keep files and share them by link." },
  instruction: { label: "Instructions", line: "Change its own rules from a chat." },
  mcp: { label: "Connections", line: "Add MCP servers from a chat." },
  media_audio: { label: "Voice", line: "Speak out loud and write down recordings." },
  media_images: { label: "Images", line: "Draw new images and edit them." },
  media_read: { label: "Reading", line: "See what is in a photo, video or PDF." },
  media_video: { label: "Video", line: "Film short videos from a description." },
  model: { label: "Models", line: "Switch its models from a chat." },
  note: { label: "Notes", line: "Write notes and find them later." },
  skill: { label: "Skills", line: "Change its own skills from a chat." },
  trigger: { label: "Triggers", line: "Act when something happens in an app." },
  vault: { label: "Vault", line: "Ask for logins and keys, and use them." },
  webhook: { label: "Webhooks", line: "Run a task when another app calls." },
}

const ORDER: ToolName[] = ["file", "note", "browser", "apps", "media_read", "media_images", "media_video", "media_audio", "automation", "trigger", "webhook", "vault", "instruction", "skill", "model", "mcp"]

// The persona's tools, each a row of its own. A switch turns a tool off. Deferring a tool is for the API only.
export function ToolsPage({ persona }: { persona: Persona }) {
  const { tools, error, isLoading } = useTools(persona.id)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Tools</SectionTitle>
        <SectionDescription>
          Choose what <span className="font-semibold text-foreground">{persona.name}</span> can do beyond talking.
        </SectionDescription>
      </SectionHeader>
      {isLoading && (
        <ScreenRows>
          {Array.from({ length: 3 }, (_, index) => (
            <ScreenRowSkeleton key={index} media={false} />
          ))}
        </ScreenRows>
      )}
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>Your tools did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {tools && (
        <ScreenRows>
          {ORDER.map((name) => (
            <ToolRow key={name} persona={persona} name={name} tools={tools} />
          ))}
        </ScreenRows>
      )}
      {tools && <p className="-mt-4 text-xs text-muted-foreground/70">Sending messages, web search and its own computer are always on.</p>}
    </Section>
  )
}

// One tool: its name and line, and its switch, which saves at once.
function ToolRow({ persona, name, tools }: { persona: Persona; name: ToolName; tools: Tools }) {
  const update = useUpdateTool(persona.id, name)
  const tool = tools[name]
  const label = TOOLS[name].label
  const line = TOOLS[name].line

  function save(input: UpdateToolInput) {
    void update.trigger(input, { optimisticData: (current: Tools = tools) => ({ ...current, [name]: { ...current[name], ...input } }) })
  }

  return (
    <ScreenRow className={cn(!tool.enabled && "opacity-60")}>
      <ItemContent className="min-w-0">
        <ItemTitle>{label}</ItemTitle>
        <ItemDescription>{line}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch checked={tool.enabled} onCheckedChange={(enabled) => save({ enabled })} aria-label={tool.enabled ? `Turn off ${label}` : `Turn on ${label}`} />
      </ItemActions>
    </ScreenRow>
  )
}
