"use client"

import { useAuth, useClerk, useOrganizationList, useUser } from "@clerk/nextjs"
import { BookOpenIcon, Building2Icon, CheckIcon, ChevronsUpDownIcon, LogOutIcon, MonitorIcon, MoonIcon, PaletteIcon, Settings2Icon, SunIcon, UserCogIcon } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

// The signed-in person at the foot of a sidebar, with their menu. Docs is a stub until that screen exists.
export function NavUser() {
  const clerk = useClerk()
  const { user } = useUser()
  const { orgId } = useAuth()
  const { userMemberships } = useOrganizationList({ userMemberships: true })
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()

  if (!user) return <NavUserSkeleton />

  const email = user.primaryEmailAddress?.emailAddress ?? ""
  const name = user.fullName ?? email
  const initial = name.slice(0, 1).toUpperCase()
  const picture = user.hasImage ? user.imageUrl : undefined
  const memberships = userMemberships.data ?? []

  async function signOut() {
    await clerk.signOut({ redirectUrl: "/sign-in" })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <Avatar>
              <AvatarImage src={picture} alt="" />
              <AvatarFallback className="font-bold">{initial}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-start leading-tight">
              <span className="truncate font-bold">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDownIcon className="ms-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "bottom" : "top"} align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2 py-1.5 font-normal tracking-normal normal-case">
                <Avatar>
                  <AvatarImage src={picture} alt="" />
                  <AvatarFallback className="font-bold">{initial}</AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 text-start leading-tight">
                  <span className="truncate text-sm font-bold text-foreground">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <BookOpenIcon />
              Docs
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings/preferences" />}>
              <UserCogIcon />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PaletteIcon />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <SunIcon />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <MoonIcon />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <MonitorIcon />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Building2Icon />
                Orgs
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-52">
                {memberships.map((membership) => (
                  <DropdownMenuItem key={membership.id} onClick={() => clerk.setActive({ organization: membership.organization.id, redirectUrl: "/" })}>
                    <Avatar className="-mx-0.5 size-5 rounded-md">
                      <AvatarImage src={membership.organization.imageUrl} alt="" />
                      <AvatarFallback className="text-[10px] font-bold">{membership.organization.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{membership.organization.name}</span>
                    {membership.organization.id === orgId && <CheckIcon className="ms-auto text-foreground" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/orgs" />}>
                  <Settings2Icon />
                  Manage organizations
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavUserSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" disabled className="disabled:opacity-100">
          <Skeleton className="size-8 shrink-0 rounded" />
          <span className="grid flex-1 gap-1.5">
            <Skeleton className="h-3 w-24 rounded-sm" />
            <Skeleton className="h-2.5 w-32 rounded-sm" />
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
