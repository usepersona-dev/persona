import { ClerkFailed } from "@clerk/nextjs"
import { Newsreader, Nunito } from "next/font/google"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { cn } from "@/lib/utils"

import { AuthLayout, AuthLayoutArt, AuthLayoutContent, AuthLayoutFooter, AuthLayoutHeader, AuthLayoutMain } from "./_components/auth-layout"

// The landing page's type: Newsreader for the card titles, Nunito for the logo
const newsreader = Newsreader({ subsets: ["latin"], axes: ["opsz"], variable: "--font-newsreader" })

const nunito = Nunito({ subsets: ["latin"], weight: "800", variable: "--font-nunito" })

// The frame every auth page shares. Each page checks auth itself, because a layout does not re-render on navigation.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayout className={cn(newsreader.variable, nunito.variable)}>
      <AuthLayoutMain>
        <AuthLayoutHeader />
        <AuthLayoutContent>
          {/* The forms wait, disabled, until Clerk loads; this says so when it never does */}
          <ClerkFailed>
            <Alert variant="destructive" className="mb-5">
              <AlertTitle>Sign-in did not load</AlertTitle>
              <AlertDescription>Check your connection, then reload the page.</AlertDescription>
            </Alert>
          </ClerkFailed>
          {children}
        </AuthLayoutContent>
        <AuthLayoutFooter />
      </AuthLayoutMain>
      <AuthLayoutArt />
    </AuthLayout>
  )
}
