"use client"

import { CheckIcon, ChevronsUpDownIcon, CompassIcon, LayoutDashboard, PlusIcon, SettingsIcon } from "lucide-react"
import Link from "next/link"

import { CirclePlusFilledIcon } from "@/components/icons"
import { NavUser } from "@/components/nav-user"
import { PersonaAvatar } from "@/components/persona-avatar"
import { ProjectAvatar } from "@/components/project-avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { usePersonas } from "@/hooks/personas"
import { useProjects, type Project } from "@/hooks/projects"

import { usePanels } from "../_hooks/use-panels"

export function ProjectSidebar({ projectId }: { projectId: string }) {
  const { projects } = useProjects()
  const project = projects?.find((item) => item.id === projectId)
  const { personas, isLoading } = usePersonas(projectId)
  const panels = usePanels()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>{project && projects ? <ProjectSwitcher projects={projects} project={project} /> : <ProjectSwitcherSkeleton />}</SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Canvas" isActive render={<Link href={`/project/${projectId}`} />}>
                  <LayoutDashboard />
                  <span>Canvas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Create" onClick={panels.openCreate}>
                  <CirclePlusFilledIcon />
                  <span>Create</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Discover" onClick={panels.openDiscover}>
                  <CompassIcon />
                  <span>Discover</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>
                  <Kbd className="text-[10px]">⌘K</Kbd>
                </SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Personas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading && <PersonasSkeleton />}
              {personas?.map((persona) => (
                <SidebarMenuItem key={persona.id} >
                  <SidebarMenuButton tooltip={persona.name} isActive={persona.id === panels.persona} onClick={() => panels.openPersona(persona.id)}>
                    <PersonaAvatar name={persona.name} imageUrl={persona.imageUrl} className="size-5 rounded" />
                    <span className="truncate">{persona.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

// The project's menu: the other projects, New Project, and this project's settings
function ProjectSwitcher({ projects, project }: { projects: Project[]; project: Project }) {
  const panels = usePanels()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
        <ProjectAvatar name={project.name} imageUrl={project.imageUrl} className="size-8" />
        <span className="grid flex-1 text-start leading-tight">
          <span className="truncate font-bold">{project.name}</span>
          {project.description && <span className="truncate text-xs text-muted-foreground">{project.description}</span>}
        </span>
        <ChevronsUpDownIcon className="ms-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projects.map((item) => (
            <DropdownMenuItem key={item.id} render={<Link href={`/project/${item.id}`} />}>
              <ProjectAvatar name={item.name} imageUrl={item.imageUrl} className="size-6" />
              {item.name}
              {item.id === project.id && <CheckIcon className="ms-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/projects/new" />}>
          <PlusIcon />
          New Project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => panels.openSettings()}>
          <SettingsIcon />
          Project settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectSwitcherSkeleton() {
  return (
    <SidebarMenuButton size="lg" disabled className="disabled:opacity-100">
      <Skeleton className="size-8 shrink-0 rounded-md" />
      <span className="grid flex-1 gap-1.5">
        <Skeleton className="h-3 w-28 rounded-sm" />
        <Skeleton className="h-2.5 w-20 rounded-sm" />
      </span>
    </SidebarMenuButton>
  )
}

function PersonasSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuButton disabled className="disabled:opacity-100">
            <Skeleton className="size-5 shrink-0 rounded" />
            <Skeleton className="h-3 w-24 rounded-sm" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  )
}
