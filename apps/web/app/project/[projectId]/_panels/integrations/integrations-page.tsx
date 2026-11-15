"use client"

import { CloudOffIcon, EllipsisIcon, PlusIcon, SearchIcon, SearchXIcon } from "lucide-react"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton, ScreenSection, ScreenSectionCount, ScreenSectionTitle } from "@/components/screen"
import { Section, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useDisconnectApp, type App, type ConnectedApp } from "@/hooks/integrations"
import type { Persona } from "@/hooks/personas"
import { cn } from "@/lib/utils"

import { useAppList } from "./use-app-list"
import { useConnectPopup } from "./use-connect-popup"

const CHIP = "flex-nowrap gap-2.5 bg-card px-3.5 py-2.5"

export function IntegrationsPage({ persona }: { persona: Persona }) {
  const { query, setQuery, error, connected, isLoadingConnected, apps, isLoadingApps, shownApps, hasMore, total, loadMore } = useAppList(persona.id)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Integrations</SectionTitle>
        <SectionDescription>
          Connect your apps so <span className="font-semibold text-foreground">{persona.name}</span> can work in them for you.
        </SectionDescription>
      </SectionHeader>
      <InputGroup className="h-11 bg-card">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={total ? `Browse ${total.toLocaleString()}+ apps to connect` : "Search apps"} aria-label="Search apps" />
      </InputGroup>
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>Your apps did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {isLoadingConnected && (
        <ScreenSection>
          <ScreenSectionTitle>Connected</ScreenSectionTitle>
          <ScreenRows>
            {Array.from({ length: 2 }, (_, index) => (
              <ScreenRowSkeleton key={index} />
            ))}
          </ScreenRows>
        </ScreenSection>
      )}
      {!!connected?.length && (
        <ScreenSection>
          <ScreenSectionTitle>
            Connected <ScreenSectionCount>{connected.length}</ScreenSectionCount>
          </ScreenSectionTitle>
          <ScreenRows>
            {connected.map((app) => (
              <ConnectedRow key={app.id} personaId={persona.id} app={app} />
            ))}
          </ScreenRows>
        </ScreenSection>
      )}
      {isLoadingApps && (
        <ScreenSection>
          <ScreenSectionTitle>More apps</ScreenSectionTitle>
          <AppGrid>
            {Array.from({ length: 6 }, (_, index) => (
              <AppTileSkeleton key={index} />
            ))}
          </AppGrid>
        </ScreenSection>
      )}
      {apps && (
        <ScreenSection>
          <ScreenSectionTitle>
            More apps <ScreenSectionCount>{apps.length.toLocaleString()}</ScreenSectionCount>
          </ScreenSectionTitle>
          {!!shownApps?.length && (
            <AppGrid>
              {shownApps.map((app) => (
                <AppTile key={app.toolkit} personaId={persona.id} app={app} />
              ))}
            </AppGrid>
          )}
          {hasMore && (
            <Button variant="outline" className="self-center" onClick={loadMore}>
              Load more
            </Button>
          )}
          {apps.length === 0 && <NoMatches query={query.trim()} onClear={() => setQuery("")} />}
        </ScreenSection>
      )}
    </Section>
  )
}

function NoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <ScreenEmpty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>No apps match “{query}”</EmptyTitle>
        <EmptyDescription>Check the spelling, or try a shorter name.</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear search
      </Button>
    </ScreenEmpty>
  )
}

// A connected account of an app, named by its email or other name when the app gives one. Its menu shows on hover, or always on a touch screen, and a spinner takes the menu's place while it disconnects.
function ConnectedRow({ personaId, app }: { personaId: string; app: ConnectedApp }) {
  const disconnect = useDisconnectApp(personaId)

  return (
    <ScreenRow>
      <ItemMedia variant="image" className="[&_img]:object-contain">
        {app.logo && <img src={app.logo} alt="" />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>
          {app.name}
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
        </ItemTitle>
        <ItemDescription>{app.displayName ?? app.description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {disconnect.isMutating ? (
          <Spinner />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${app.name}`} className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => disconnect.trigger(app.id)}>
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </ItemActions>
    </ScreenRow>
  )
}

function AppGrid({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-2 gap-2.5 @lg:grid-cols-3", className)} {...props} />
}

function AppTile({ personaId, app }: { personaId: string; app: App }) {
  const { open, connecting } = useConnectPopup(personaId)

  return (
    <Item variant="outline" size="sm" render={<button type="button" aria-label={`Connect ${app.name}`} disabled={connecting} onClick={() => open(app)} />} className={cn(CHIP, "group/app cursor-pointer text-start hover:border-foreground/20 disabled:cursor-default")}>
      {app.logo ? <img src={app.logo} alt="" loading="lazy" className="size-5 shrink-0 object-contain" /> : <span className="size-5 shrink-0 rounded-full bg-muted" />}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{app.name}</span>
      {connecting ? <Spinner className="text-muted-foreground" /> : <PlusIcon className="hidden size-3.5 shrink-0 opacity-0 transition-opacity group-hover/app:opacity-100 group-focus-visible/app:opacity-100 @lg:block" />}
    </Item>
  )
}

function AppTileSkeleton() {
  return (
    <Item aria-hidden variant="outline" size="sm" className={CHIP}>
      <Skeleton className="size-5 shrink-0" />
      <Skeleton className="h-4 flex-1" />
    </Item>
  )
}
