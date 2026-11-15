"use client"

import { ChevronDownIcon, ChevronRightIcon, CloudOffIcon, LockIcon, PlusIcon, SquareDashedIcon } from "lucide-react"
import Image from "next/image"

import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton, ScreenSection, ScreenSectionTitle } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import type { Persona } from "@/hooks/personas"
import { useCredentials, type VaultCredential } from "@/hooks/vault"

import { usePanels } from "../../_hooks/use-panels"
import { CredentialPanel } from "./credential-panel"
import { BLANK, PRESETS } from "./presets"

const INTEGRATIONS = [
  { name: "Stripe Link", description: "Approve a purchase and Link mints a single-use card for it.", logo: "/wallet/link.png" },
  { name: "Agentcard", description: "A dedicated virtual card, with the limits you set.", logo: "/wallet/agentcard.png" },
]

// The persona's vault: the logins, cards and keys it can use, values never shown. The card integrations come later.
// A row opens its panel (&credential=<id>), and New opens an empty one (new) or one with a preset's fields (new:<preset>). The panel holds while it slides out.
export function VaultPage({ persona }: { persona: Persona }) {
  const panels = usePanels()
  const { credentials, error, isLoading } = useCredentials(persona.id)
  const opened = panels.credential.data
  const edited = credentials?.find((credential) => credential.id === opened)
  const preset = PRESETS.find((item) => `new:${item.key}` === opened)
  const creating = opened === "new" || !!preset

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Vault</SectionTitle>
        <SectionDescription>
          Logins, cards and keys <span className="font-semibold text-foreground">{persona.name}</span> can use.
        </SectionDescription>
        <SectionAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" />}>
              <PlusIcon data-icon="inline-start" />
              New
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {PRESETS.map((preset) => (
                <DropdownMenuItem key={preset.key} onClick={() => panels.openCredential(`new:${preset.key}`)}>
                  {preset.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => panels.openCredential("new")}>
                Blank
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SectionAction>
      </SectionHeader>
      <ScreenSection>
        <ScreenSectionTitle>Integrations</ScreenSectionTitle>
        <ScreenRows>
          {INTEGRATIONS.map((integration) => (
            <ScreenRow key={integration.name} className="opacity-60">
              <ItemMedia variant="image" className="rounded-lg">
                <Image src={integration.logo} alt="" width={40} height={40} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>{integration.name}</ItemTitle>
                <ItemDescription>{integration.description}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant="outline">Coming soon</Badge>
              </ItemActions>
            </ScreenRow>
          ))}
        </ScreenRows>
      </ScreenSection>
      <ScreenSection>
        <ScreenSectionTitle>Credentials</ScreenSectionTitle>
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
              <EmptyTitle>Your vault did not load</EmptyTitle>
              <EmptyDescription>{error.message}</EmptyDescription>
            </EmptyHeader>
          </ScreenEmpty>
        )}
        {credentials?.length === 0 && (
          <ScreenEmpty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LockIcon />
              </EmptyMedia>
              <EmptyTitle>No credentials yet</EmptyTitle>
              <EmptyDescription>Credentials you add show up here.</EmptyDescription>
            </EmptyHeader>
          </ScreenEmpty>
        )}
        {!!credentials?.length && (
          <ScreenRows>
            {credentials.map((credential) => (
              <CredentialRow key={credential.id} credential={credential} onOpen={() => panels.openCredential(credential.id)} />
            ))}
          </ScreenRows>
        )}
      </ScreenSection>
      {(creating || edited) && <CredentialPanel key={opened} persona={persona} credential={edited ?? null} start={preset?.fields ?? BLANK} open={panels.credential.open} onOpenChange={(open) => !open && panels.closeCredential()} />}
    </Section>
  )
}

// The whole row opens the credential, and a chevron shows on hover. A badge counts the fields still without a value.
function CredentialRow({ credential, onOpen }: { credential: VaultCredential; onOpen: () => void }) {
  const missing = credential.fields.length - credential.filled.length

  return (
    <ScreenRow className="relative">
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={onOpen} className="text-start outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {credential.title}
          </button>
        </ItemTitle>
        <ItemDescription>{credential.description || credential.fields.map((field) => field.name).join(", ")}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {missing > 0 && <Badge variant="secondary">{missing} missing</Badge>}
        <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100 rtl:rotate-180" />
      </ItemActions>
    </ScreenRow>
  )
}
