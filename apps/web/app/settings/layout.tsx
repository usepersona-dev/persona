import Image from "next/image"

import { SettingsSidebar } from "@/components/settings-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Settings has its own sidebar. Each page checks auth itself, because a layout does not re-render on navigation.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <SettingsSidebar />
      <SidebarInset className="@container isolate">
        <header className="flex h-12 shrink-0 items-center border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <SettingsLayoutCorners />
        <SettingsLayoutContent>{children}</SettingsLayoutContent>
      </SidebarInset>
    </SidebarProvider>
  )
}

// Small clay pieces in the corners of the page area, behind the page: a vine top-left, the persona waving between two clouds top-right, grass in both bottom corners and half a tree bottom-right, cut off by the edge.
// The top pieces need the margin beside the column, so they show from a page area of 880px, the tree from 760px. The persona floats up once, when settings opens.
function SettingsLayoutCorners({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden data-slot="settings-layout-corners" className={cn("pointer-events-none absolute inset-0 -z-10 overflow-clip select-none", className)} {...props}>
      <Image src="/art/settings/vine-left.webp" alt="" width={112} height={78} className="absolute top-0 left-0 hidden @min-[880px]:block" />
      <Image src="/art/settings/cloud-small.webp" alt="" width={46} height={30} className="absolute top-3.5 right-[114px] hidden @min-[880px]:block" />
      <Image src="/art/settings/persona-wave.webp" alt="" width={76} height={46} className="absolute top-[30px] right-[34px] hidden transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none @min-[880px]:block starting:translate-y-2 starting:opacity-0"/>
      <Image src="/art/settings/cloud-big.webp" alt="" width={62} height={37} className="absolute top-[84px] -right-4 hidden @min-[880px]:block" />
      <Image src="/art/settings/tree.webp" alt="" width={89} height={110} className="absolute -right-[42px] bottom-0 hidden @min-[760px]:block" />
      <Image src="/art/settings/grass-left.webp" alt="" width={117} height={32} className="absolute bottom-0 left-0" />
      <Image src="/art/settings/grass-right.webp" alt="" width={119} height={32} className="absolute right-0 bottom-0" />
    </div>
  )
}

function SettingsLayoutContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="settings-layout-content" className={cn("mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 pt-16 pb-32 has-[[data-wide]]:max-w-5xl", className)} {...props} />
}
