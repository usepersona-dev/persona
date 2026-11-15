import type { Metadata } from "next"
import { Geist, Geist_Mono, Newsreader, Nunito } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

// Titles are Newsreader and the "persona" word is Nunito, on the landing and on the legal pages
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-newsreader" })

const nunito = Nunito({ subsets: ["latin"], weight: "800", variable: "--font-nunito" })

const TITLE = "Persona · The agent factory"

const DESCRIPTION = "Make AI agents for your business, your family, or your customers. Each one has its own skills, apps and schedule."

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s · Persona" },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Persona", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
}

// The site pages: the landing and the legal pages. Light only, so there is no theme provider. The app lives on app.usepersona.dev.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("persona", geistMono.variable, geist.variable, newsreader.variable, nunito.variable)}>
      <body>{children}</body>
    </html>
  )
}
