"use client"

import { CloudOffIcon, KeyRoundIcon, PlusIcon } from "lucide-react"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { useConnections, useUpdateConnection, type Connection } from "@/hooks/connections"
import type { Persona } from "@/hooks/personas"
import { cn } from "@/lib/utils"

import { usePanels } from "../../_hooks/use-panels"
import { ConnectionPanel } from "./connection-panel"

// The persona's MCP servers, whose tools it uses while they are on. A row opens its panel (&connection=<id>, or new), which holds while it slides out.
export function ConnectionsPage({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { connections, error, isLoading } = useConnections(persona.id)
  const edited = connections?.find((connection) => connection.id === panels.connection.data)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Connections</SectionTitle>
        <SectionDescription>
          Add MCP servers to give <span className="font-semibold text-foreground">{persona.name}</span> more tools.
        </SectionDescription>
        <SectionAction>
          <Button size="sm" onClick={() => panels.openConnection("new")}>
            <PlusIcon data-icon="inline-start" />
            New
          </Button>
        </SectionAction>
      </SectionHeader>
      {isLoading && (
        <ScreenRows>
          {Array.from({ length: 3 }, (_, index) => (
            <ScreenRowSkeleton key={index} />
          ))}
        </ScreenRows>
      )}
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>Your connections did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {connections?.length === 0 && (
        <ScreenEmpty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>No connections yet</EmptyTitle>
            <EmptyDescription>Connections you add show up here.</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {!!connections?.length && (
        <ScreenRows>
          {connections.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection} onOpen={() => panels.openConnection(connection.id)} />
          ))}
        </ScreenRows>
      )}
      {(panels.connection.data === "new" || edited) && <ConnectionPanel key={panels.connection.data} persona={persona} connection={edited ?? null} open={panels.connection.open} onOpenChange={(open) => !open && panels.closeConnection()} />}
    </Section>
  )
}

// The whole row opens the connection, and its switch turns it on or off in place.
function ConnectionRow({ connection, onOpen }: { connection: Connection; onOpen: () => void }) {
  const update = useUpdateConnection(connection)
  const details = connection.description || connection.url

  function toggle(enabled: boolean) {
    void update.trigger({ enabled }, { optimisticData: (list: Connection[] = []) => list.map((item) => (item.id === connection.id ? { ...item, enabled } : item)) })
  }

  return (
    <ScreenRow className={cn("relative", !connection.enabled && "opacity-60")}>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={onOpen} className="text-start outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {connection.name}
          </button>
        </ItemTitle>
        <ItemDescription>{connection.enabled ? details : `Off · ${details}`}</ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <Switch checked={connection.enabled} onCheckedChange={toggle} aria-label={connection.enabled ? `Turn off ${connection.name}` : `Turn on ${connection.name}`} />
      </ItemActions>
    </ScreenRow>
  )
}
