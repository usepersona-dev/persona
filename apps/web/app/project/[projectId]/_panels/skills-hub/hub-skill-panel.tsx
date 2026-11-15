"use client"

import { CloudOffIcon, DownloadIcon, PackageIcon } from "lucide-react"
import { Streamdown } from "streamdown"

import { Property } from "@/components/property"
import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { Persona } from "@/hooks/personas"
import { useInstallMarketplaceSkill, useMarketplaceSkill, useSkills } from "@/hooks/skills"

import { FilesProperty, SkillSkeleton } from "../skills/skill-panel"
import { installs } from "./use-skills-hub"

// A skill from skills.sh, read before it is installed. It reads like a saved skill, and Install copies it to the persona under the name it shows.
// It is installed when a skill of the persona came from this skills.sh id; another skill that only shares the name blocks the install, since names are unique.
export function HubSkillPanel({ persona, marketplaceId, open, onOpenChange }: { persona: Persona; marketplaceId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <HubSkill persona={persona} marketplaceId={marketplaceId} onClose={() => onOpenChange(false)} />
    </SidePanel>
  )
}

function HubSkill({ persona, marketplaceId, onClose }: { persona: Persona; marketplaceId: string; onClose: () => void }) {
  const { skill, error } = useMarketplaceSkill(marketplaceId)
  const { skills } = useSkills(persona.id)
  const install = useInstallMarketplaceSkill(persona.id)
  const installed = !!skills?.some((own) => own.origin.id === marketplaceId)

  async function installSkill() {
    const added = await install.trigger(marketplaceId)
    if (!added) return

    toast.add({ title: `Installed “${added.name}”`, type: "success" })
    onClose()
  }

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{skill?.name ?? "Skill from skills.sh"}</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          {error && (
            <Empty role="alert">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                  <CloudOffIcon />
                </EmptyMedia>
                <EmptyTitle>This skill did not load</EmptyTitle>
                <EmptyDescription>{error.message}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!error && !skill && <SkillSkeleton />}
          {skill && (
            <div className="flex flex-col gap-6">
              <h2 className="font-mono text-3xl leading-tight font-semibold tracking-tight break-words">{skill.name}</h2>
              <div className="flex flex-col gap-1">
                <Property icon={PackageIcon} label="Source">
                  <span className="truncate font-mono text-sm">{skill.source}</span>
                </Property>
                <Property icon={DownloadIcon} label="Installs">
                  <span className="font-mono text-sm">{installs(skill.installs)}</span>
                </Property>
                {!!skill.files.length && <FilesProperty paths={skill.files.map((file) => file.path)} />}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">When to use it</h3>
                <p className="max-h-[30dvh] overflow-y-auto rounded-[10px] border bg-card px-4 py-3 text-base leading-7">{skill.description}</p>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">How to do it</h3>
                {skill.markdown ? <Streamdown className="max-h-[50dvh] overflow-y-auto rounded-[10px] border bg-card px-5 py-4">{skill.markdown}</Streamdown> : <p className="rounded-[10px] border bg-card px-4 py-3 text-base text-muted-foreground">This skill has no steps.</p>}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="button" disabled={!skills || installed || install.isMutating} onClick={installSkill}>
                  {install.isMutating && <Spinner data-icon="inline-start" />}
                  {installed ? "Installed" : install.isMutating ? "Installing…" : "Install"}
                </Button>
              </div>
            </div>
          )}
        </Section>
      </SidePanelBody>
    </>
  )
}
