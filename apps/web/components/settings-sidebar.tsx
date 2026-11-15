"use client"

import { ArrowLeftIcon, Building2Icon, ChartLineIcon, CreditCardIcon, KeyRoundIcon, SlidersHorizontalIcon, UserRoundIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@/components/ui/sidebar"

const GROUPS = [
  {
    label: "Account",
    items: [
      { label: "Preferences", href: "/settings/preferences", icon: SlidersHorizontalIcon },
      { label: "Profile", href: "/settings/profile", icon: UserRoundIcon },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Organization", href: "/settings/organization", icon: Building2Icon },
      { label: "API keys", href: "/settings/api-keys", icon: KeyRoundIcon },
      { label: "Usage", href: "/settings/usage", icon: ChartLineIcon },
      { label: "Billing", href: "/settings/billing", icon: CreditCardIcon },
    ],
  },
]

// The sections replace each other in the history. Back is a link to the app, not the browser's Back: after a Google sign-in, that history holds Google's pages.
export function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Back" render={<Link href="/" />}>
              <ArrowLeftIcon />
              <span>Back</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton tooltip={item.label} isActive={pathname === item.href} render={<Link href={item.href} replace />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
