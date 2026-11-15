import Image from "next/image"
import Link from "next/link"
import * as React from "react"
import { Streamdown } from "streamdown"

import { cn } from "@/lib/utils"

// The legal pages: a framed banner of the landing's workshop painting with the title on its sky, then the markdown text. The landing's footer closes the page.
//
//   <LegalLayout>
//     <LegalHeader>
//       <LegalTitle>Terms of Service</LegalTitle>
//       <LegalDescription>Last updated October 21, 2026</LegalDescription>
//     </LegalHeader>
//     <LegalContent>{terms}</LegalContent>
//     <Footer />
//   </LegalLayout>

function LegalLayout({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="legal-layout" className={cn("flex min-h-svh flex-col bg-background", className)} {...props} />
}

// The painting is a day sky, so the text on it keeps dark ink. The logo is the landing's top-bar logo: the painted cloud and "persona" in Nunito.
function LegalHeader({ className, children, ...props }: React.ComponentProps<"header">) {
  return (
    <header data-slot="legal-header" className={cn("relative isolate m-3 flex min-h-[clamp(320px,46vh,460px)] flex-col overflow-hidden rounded-[calc(var(--radius)*3)] bg-sky p-5 text-foreground", className)} {...props}>
      <Image src="/art/workshop.webp" alt="" fill preload sizes="100vw" className="-z-10 object-cover object-[50%_35%]" />
      <Link href="/" className="flex w-fit items-center gap-[9px] font-wordmark text-[25px] leading-none font-extrabold tracking-[-0.04em] text-[#1d1d1b]">
        <Image src="/brand/mark.webp" alt="" width={40} height={40} className="size-8 rounded-[9px]" />
        persona
      </Link>
      <div className="flex flex-1 flex-col items-center gap-3 pt-[clamp(32px,6vh,64px)] text-center">{children}</div>
    </header>
  )
}

function LegalTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 data-slot="legal-title" className={cn("font-heading text-[clamp(40px,5.5vw,68px)] leading-[1.05] font-normal tracking-[-0.015em] text-balance", className)} {...props} />
}

function LegalDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="legal-description" className={cn("text-base font-medium text-foreground/70", className)} {...props} />
}

// Streamdown sets list bullets inside the text by default, so a wrapped line would start under its bullet. Section titles are Newsreader at its regular weight, as on the landing.
function LegalContent({ className, ...props }: React.ComponentProps<typeof Streamdown>) {
  return (
    <main data-slot="legal-content" className="mx-auto w-full max-w-[680px] flex-1 px-5 py-14">
      <Streamdown mode="static" linkSafety={{ enabled: false }} className={cn("[&_h2]:font-heading [&_h2]:font-normal [&_h2]:tracking-[-0.012em] [&_ul]:list-outside [&_ul]:ps-5", className)} {...props} />
    </main>
  )
}

export { LegalContent, LegalDescription, LegalHeader, LegalLayout, LegalTitle }
