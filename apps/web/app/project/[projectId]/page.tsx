import { notFound } from "next/navigation"

import { requireSession } from "@/usecases/auth"
import { getProject } from "@/usecases/projects"

import { ProjectCanvas } from "./_components/project-canvas"

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { caller } = await requireSession()
  const { projectId } = await params
  
  const project = await getProject(caller, projectId)
  if (!project.ok) notFound()

  return <ProjectCanvas projectId={projectId} />
}
