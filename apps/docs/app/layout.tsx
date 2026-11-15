import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { RootProvider } from "fumadocs-ui/provider/next"
import { MessageCircleIcon } from "lucide-react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Newsreader, Nunito } from "next/font/google"

import "./globals.css"
import { AISearch, AISearchPanel, AISearchTrigger } from "@/components/ai/search"
import { buttonVariants } from "@/components/button"
import { cn } from "@/lib/cn"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

// Headings and the "persona" word, as on the landing page
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-newsreader" })

const nunito = Nunito({ subsets: ["latin"], weight: "800", variable: "--font-nunito" })

const DESCRIPTION = "Documentation for Persona, the agent factory: make AI agents with your rules, skills and apps, and put them on WhatsApp, Telegram or the web."

// NEXT_PUBLIC_DOCS_URL sets the origin of the social card and canonical URLs
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.usepersona.dev"),
  title: { default: "Persona docs", template: "%s · Persona docs" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Persona docs", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", description: DESCRIPTION },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(geistMono.variable, geist.variable, newsreader.variable, nunito.variable)}>
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
            <AISearch>
              <AISearchPanel />
              <AISearchTrigger position="float" className={buttonVariants({ variant: "secondary" })}>
                <MessageCircleIcon className="size-4.5" />
                Ask AI
              </AISearchTrigger>
            </AISearch>
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
