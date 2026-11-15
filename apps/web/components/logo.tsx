import Image from "next/image"

import { cn } from "@/lib/utils"

// The landing page's logo: the painted cloud on its sky tile and "persona" in Nunito. A text size class sets its size.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.36em] font-wordmark text-[25px] leading-none font-extrabold tracking-[-0.04em]", className)}>
      <Image src="/brand/mark.webp" alt="" width={40} height={40} loading="eager" className="size-[1.28em] rounded-[0.36em]" />
      persona
    </span>
  )
}
