import { ClerkFailed } from "@clerk/nextjs"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { AuthLayout, AuthLayoutArt, AuthLayoutContent, AuthLayoutFooter, AuthLayoutHeader, AuthLayoutMain } from "./_components/auth-layout"

// The frame every auth page shares. Each page checks auth itself, because a layout does not re-render on navigation.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayout>
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
