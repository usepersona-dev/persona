"use client"

import { usePanelState } from "@/components/side-panel"
import { usePersonas } from "@/hooks/personas"
import { useProjects } from "@/hooks/projects"

import { DiscoverDialog } from "../_components/discover-dialog"
import { usePanels } from "../_hooks/use-panels"
import { CreatePersonaPanel } from "./create-persona-panel"
import { PersonaPanel } from "./persona-panel"
import { ProjectSettingsPanel } from "./project-settings-panel"

// Every panel and dialog the URL can open, mounted once by the canvas. Other parts only open and close them through usePanels.
// The panels that act on one persona get it from the list the canvas already has, and the settings get the project from the sidebar's list, so they open at once. usePanelState keeps the last one while it animates out.
export function ProjectPanels({ projectId }: { projectId: string }) {
  const panels = usePanels()
  const { personas } = usePersonas(projectId)
  const { projects } = useProjects()
  const project = projects?.find((project) => project.id === projectId)
  
  const viewed = usePanelState(personas?.find((persona) => persona.id === panels.persona))
  const creating = usePanelState(panels.creating)
  const settings = usePanelState(panels.settings ? project : null)

  function changePanel(open: boolean) {
    if (open) return
    panels.close()
  }

  function changeDialog(open: boolean) {
    if (open) return
    panels.closeDialog()
  }

  return (
    <>
      {viewed.data && <PersonaPanel persona={viewed.data} open={viewed.open} onOpenChange={changePanel} />}
      {creating.data && <CreatePersonaPanel projectId={projectId} from={creating.data} open={creating.open} onOpenChange={changePanel} />}
      {settings.data && <ProjectSettingsPanel project={settings.data} open={settings.open} onOpenChange={changePanel} />}
      <DiscoverDialog projectId={projectId} open={panels.discovering} onOpenChange={changeDialog} />
    </>
  )
}
