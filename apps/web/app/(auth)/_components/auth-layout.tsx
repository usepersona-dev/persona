import Image from "next/image"
import Link from "next/link"
import * as React from "react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

// The auth pages: a form column on the left and a framed painting on the right.
// Spacing lives on the slots, so a page is just the slots in order.
//
// The frame, once in app/(auth)/layout.tsx:
//
//   <AuthLayout>
//     <AuthLayoutMain>
//       <AuthLayoutHeader />
//       <AuthLayoutContent>{children}</AuthLayoutContent>
//       <AuthLayoutFooter />
//     </AuthLayoutMain>
//     <AuthLayoutArt />
//   </AuthLayout>
//
// Sign-in and sign-up are Clerk's own cards, with the painted cloud at the top of the card:
//
//   <AuthClerkCard>
//     <SignIn appearance={{ elements: clerkCard }} />
//   </AuthClerkCard>
//
// Any other step is our card:
//
//   <AuthScreen>
//     <AuthHeader>
//       <AuthTitle>Name your project</AuthTitle>
//       <AuthDescription>Personas live in projects</AuthDescription>
//     </AuthHeader>
//     <form>…</form>
//     <AuthFooter>
//       <AuthFooterLink href="/">Back</AuthFooterLink>
//     </AuthFooter>
//   </AuthScreen>

function AuthLayout({ className, ...props }: React.ComponentProps<"main">) {
  return <main data-slot="auth-layout" className={cn("grid min-h-svh bg-background lg:grid-cols-2", className)} {...props} />
}

function AuthLayoutMain({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="auth-layout-main" className={cn("relative isolate flex min-h-svh flex-col px-[clamp(20px,5vw,56px)] py-6", className)} {...props} />
}

// The logo, home. On a phone the art column hides, so the sign-in painting fades in behind the top of the page. It sits out of the flow, so it adds no height.
function AuthLayoutHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header data-slot="auth-layout-header" className={cn("flex", className)} {...props}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)] lg:hidden">
        <Painting className="object-[50%_30%]" />
      </div>
      <Link href={process.env.NEXT_PUBLIC_SITE_URL!} className="flex">
        <Logo />
      </Link>
    </header>
  )
}

// flex-1 with justify-center keeps a step in the middle of the column, whatever its height
function AuthLayoutContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="auth-layout-content" className={cn("mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-8 lg:py-12", className)} {...props} />
}

function AuthLayoutFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer data-slot="auth-layout-footer" className={cn("flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-muted-foreground", className)} {...props}>
      <span>© 2026 Persona</span>
      <nav className="flex gap-4">
        <Link href={`${process.env.NEXT_PUBLIC_SITE_URL}/terms`} className="hover:text-foreground">
          Terms
        </Link>
        <Link href={`${process.env.NEXT_PUBLIC_SITE_URL}/privacy`} className="hover:text-foreground">
          Privacy
        </Link>
      </nav>
    </footer>
  )
}

function AuthLayoutArt({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside data-slot="auth-layout-art" className={cn("relative m-3 hidden overflow-hidden rounded-[18px] bg-muted lg:block", className)} {...props}>
      <Painting preload className="object-[50%_70%]" />
    </aside>
  )
}

// One step, as a card. `art` is the step's mascot, standing on the card's top edge.
function AuthScreen({ art, className, ...props }: React.ComponentProps<typeof Card> & { art?: string }) {
  return (
    <div data-slot="auth-screen" className={cn("relative w-full", art && "pt-[100px]")}>
      {art && <Mascot src={art} />}
      <Card className={cn("w-full gap-5 px-[clamp(22px,5vw,38px)] pb-8", art ? "pt-24" : "pt-8", className)} {...props} />
    </div>
  )
}

// Clerk's card for sign-in and sign-up, with the painted cloud at the top of the card
function AuthClerkCard({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="auth-clerk-card" className="relative w-full">
      <Image src="/brand/mark.webp" alt="" width={64} height={64} preload className="pointer-events-none absolute top-[34px] left-1/2 z-10 size-16 -translate-x-1/2 rounded-[18px] shadow-[0_6px_16px_rgb(36_43_49/0.18)]" />
      {children}
    </div>
  )
}

// Clerk's card at the column's width, with room for the painted cloud, no logo square, the title in the landing's serif and a pill button. Clerk's own styles outrank plain classes, hence the !
const clerkCard = { rootBox: "!w-full", cardBox: "!w-full !max-w-none", card: "!pt-[114px]", logoBox: "!hidden", headerTitle: "!font-display !text-[32px] !leading-[1.15] !font-normal !tracking-[-0.015em]", headerSubtitle: "!text-base", formButtonPrimary: "!h-[42px] !rounded-full" }

function Mascot({ src }: { src: string }) {
  return <Image unoptimized src={src} alt="" width={180} height={180} className="pointer-events-none absolute top-0 left-1/2 z-10 size-[180px] -translate-x-1/2 object-contain drop-shadow-[0_14px_16px_rgb(33_62_118/0.2)]" />
}

function AuthHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="auth-header" className={cn("flex flex-col items-center gap-1.5 text-center", className)} {...props} />
}

function AuthTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 data-slot="auth-title" className={cn("font-heading text-3xl font-semibold tracking-tight text-balance", className)} {...props} />
}

function AuthDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="auth-description" className={cn("text-base text-balance text-muted-foreground", className)} {...props} />
}

// The line under a form ("New here? Create an account"), with its links and buttons inline
function AuthFooter({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="auth-footer" className={cn("text-center text-sm text-muted-foreground", className)} {...props} />
}

function AuthFooterLink({ href, className, ...props }: Omit<React.ComponentProps<typeof Button>, "variant" | "nativeButton" | "render"> & { href: string }) {
  return <Button variant="link" nativeButton={false} render={<Link href={href} />} className={cn("h-auto p-0", className)} {...props} />
}

function AuthFooterButton({ className, ...props }: Omit<React.ComponentProps<typeof Button>, "variant">) {
  return <Button type="button" variant="link" className={cn("h-auto p-0", className)} {...props} />
}

// A step that only waits on Clerk, such as the Google return or a finished sign-in: the heading over a spinner
function AuthPending({ art, title, description }: { art?: string; title: React.ReactNode; description: React.ReactNode }) {
  return (
    <AuthScreen art={art} aria-busy="true">
      <AuthHeader>
        <AuthTitle>{title}</AuthTitle>
        <AuthDescription>{description}</AuthDescription>
      </AuthHeader>
      <Spinner className="mx-auto size-5 text-muted-foreground" />
    </AuthScreen>
  )
}

// The painted workshop, as on the landing page: a day version, and a night one for dark mode. Served as is (unoptimized), so they keep every pixel.
function Painting({ preload, className }: { preload?: boolean; className?: string }) {
  return (
    <>
      <Image unoptimized src="/art/auth/workshop-day.webp" alt="" fill preload={preload} className={cn("object-cover dark:hidden", className)} />
      <Image unoptimized src="/art/auth/workshop-night.webp" alt="" fill className={cn("hidden object-cover dark:block", className)} />
    </>
  )
}

export {
  AuthClerkCard,
  AuthDescription,
  AuthFooter,
  AuthFooterButton,
  AuthFooterLink,
  AuthHeader,
  AuthLayout,
  AuthLayoutArt,
  AuthLayoutContent,
  AuthLayoutFooter,
  AuthLayoutHeader,
  AuthLayoutMain,
  AuthPending,
  AuthScreen,
  AuthTitle,
  clerkCard,
}
