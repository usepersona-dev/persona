import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import Image from "next/image"

// The landing page's logo: the painted cloud on its sky tile and "persona" in Nunito
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image src="/brand/mark.webp" alt="" width={40} height={40} className="size-7 rounded-[8px]" />
          <span className="font-wordmark text-[1.35rem] leading-none font-extrabold tracking-[-0.04em]">persona</span>
        </>
      ),
    },
  }
}
