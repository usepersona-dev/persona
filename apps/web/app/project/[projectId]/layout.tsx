import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

import { ProjectSidebar } from "./_components/project-sidebar"

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params

  return (
    <SidebarProvider>
      <ProjectSidebar projectId={projectId} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
