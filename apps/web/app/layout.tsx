import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Newsreader, Nunito } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import "./globals.css"
import { PostHogIdentify } from "@/components/posthog-identify"
import { SwrProvider } from "@/components/swr-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans"
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const newsreader = Newsreader({ subsets: ["latin"], axes: ["opsz"], variable: "--font-newsreader" })
const nunito = Nunito({ subsets: ["latin"], weight: "800", variable: "--font-nunito" })

export const metadata: Metadata = {
  title: "Persona",
  description: "Make AI agents for your business, your family, or your customers. Each one has its own skills, apps and schedule.",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        geistMono.variable,
        geist.variable,
        newsreader.variable,
        nunito.variable
      )}
    >
      <body>
        <ClerkProvider appearance={{ theme: shadcn }} localization={{ signUp: { start: { subtitle: "Welcome to the agent factory. Free to start, no card needed." } } }} taskUrls={{ "choose-organization": "/orgs" }}>
          <PostHogIdentify />
          <ThemeProvider>
            <NuqsAdapter>
              <SwrProvider>
                <TooltipProvider>{children}</TooltipProvider>
              </SwrProvider>
            </NuqsAdapter>
            <Toaster />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
