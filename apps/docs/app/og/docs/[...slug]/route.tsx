import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { notFound } from "next/navigation"
import { ImageResponse } from "next/og"

import { getPageImage, source } from "@/lib/source"

export const revalidate = false

// The share card of a docs page, in the landing page's look: the painted workshop with the logo (public/og/card.jpg), and the page's title and description on its calm middle
const card = `data:image/jpeg;base64,${(await readFile(join(process.cwd(), "public/og/card.jpg"))).toString("base64")}`
const newsreader = await readFile(join(process.cwd(), "assets/fonts/Newsreader-Regular.ttf"))
const geist = await readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf"))

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const page = source.getPage(slug.slice(0, -1))
  if (!page) notFound()

  return new ImageResponse(
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain img elements; next/image does not render here */}
      <img src={card} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={{ position: "absolute", top: 150, left: 150, right: 150, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: "Newsreader", fontSize: 96, lineHeight: 1.05, letterSpacing: -2.5, color: "#252522" }}>{page.data.title}</div>
        {page.data.description && <div style={{ marginTop: 30, maxWidth: 740, fontFamily: "Geist", fontSize: 27, lineHeight: 1.4, color: "#2f312d" }}>{page.data.description}</div>}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Newsreader", data: newsreader, style: "normal", weight: 400 },
        { name: "Geist", data: geist, style: "normal", weight: 400 },
      ],
    }
  )
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }))
}
