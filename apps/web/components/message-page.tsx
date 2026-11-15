import Image from "next/image"

import { cn } from "@/lib/utils"

// The not-found and error pages: the cloud and a short message, centered on plain paper
function MessagePage({ className, children, ...props }: React.ComponentProps<"main">) {
  return (
    <main data-slot="message-page" className={cn("flex min-h-svh flex-col items-center justify-center bg-background px-5 py-12 text-center", className)} {...props}>
      <Image unoptimized src="/art/wave.webp" alt="" width={144} height={144} preload className="size-36 object-contain" />
      {children}
    </main>
  )
}

function MessagePageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 data-slot="message-page-title" className={cn("mt-4 font-heading text-3xl font-semibold tracking-tight text-balance", className)} {...props} />
}

function MessagePageDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="message-page-description" className={cn("mt-1.5 max-w-[28em] text-base text-balance text-muted-foreground", className)} {...props} />
}

function MessagePageActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-page-actions" className={cn("mt-8 flex flex-col items-center gap-4", className)} {...props} />
}

export { MessagePage, MessagePageActions, MessagePageDescription, MessagePageTitle }
