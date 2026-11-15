import { format } from "date-fns"
import { DownloadIcon, ExternalLinkIcon, FileIcon } from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Streamdown } from "streamdown"

import { PersonaAvatar } from "@/components/persona-avatar"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getPublishedFile } from "@/usecases/files"

import { formatSize, kindOf, typeLabel, type Kind } from "../../_lib/file-info"

type Params = { personaId: string; fileId: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { personaId, fileId } = await params
  const file = await getPublishedFile(personaId, fileId)
  return { title: file.ok ? file.value.name : "File" }
}

// files.usepersona.dev/<personaId>/<fileId>: a published file. A mini app (HTML) fills the window, framed from the persona's own host, so nothing a persona wrote
// runs on this site. Every other file gets a slim header with Open and Download, then the file as its type allows. No sign-in: a public file is for everyone, a private one is 404
export default async function FilePage({ params }: { params: Promise<Params> }) {
  const { personaId, fileId } = await params
  const file = await getPublishedFile(personaId, fileId)
  if (!file.ok) notFound()

  const address = file.value.url
  const kind = kindOf(file.value)
  if (kind === "html") return <iframe src={address} title={file.value.name} allow="fullscreen; autoplay; clipboard-write" allowFullScreen className="fixed inset-0 size-full border-0" />

  // Markdown, text and code are rendered here, read from the file's own address like any browser would
  const text = kind === "markdown" || kind === "text" ? await (await fetch(address)).text() : null
  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b px-3 py-2.5 md:px-4">
        <PersonaAvatar name={file.value.persona.name} imageUrl={file.value.persona.imageUrl} className="size-8 rounded-lg" />
        <div className="flex min-w-0 flex-col">
          <h1 dir="auto" className="truncate text-sm font-semibold">{file.value.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {file.value.persona.name} · {typeLabel(file.value)} · {formatSize(file.value.size)} · {format(new Date(file.value.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <div className="ms-auto flex shrink-0 gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={address} target="_blank" rel="noreferrer" />} className="max-sm:hidden">
            <ExternalLinkIcon data-icon="inline-start" />
            Open
          </Button>
          <Button size="sm" nativeButton={false} render={<a href={`${address}?download`} />}>
            <DownloadIcon data-icon="inline-start" />
            Download
          </Button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/50 p-3 md:p-8">
        <FilePreview kind={kind} name={file.value.name} address={address} text={text} label={typeLabel(file.value)} />
      </main>
    </div>
  )
}

function FilePreview({ kind, name, address, text, label }: { kind: Kind; name: string; address: string; text: string | null; label: string }) {
  if (kind === "image") return <Image unoptimized src={address} alt={name} width={1600} height={1200} className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain shadow-sm" />
  if (kind === "pdf") return <iframe src={address} title={name} className="size-full max-w-5xl rounded-lg border bg-background" />
  if (kind === "video") return <video src={address} controls className="max-h-full max-w-full rounded-lg bg-black" />
  if (kind === "audio") return <audio src={address} controls className="w-full max-w-md" />
  if (text !== null) {
    return (
      <article dir="auto" className="max-h-full w-full max-w-3xl overflow-auto rounded-xl border bg-background p-5 text-start shadow-sm md:p-10">
        {kind === "markdown" ? <Streamdown>{text}</Streamdown> : <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap">{text}</pre>}
      </article>
    )
  }

  const description = kind === "large" ? "It is too big to show here. Download it to see it." : `A browser cannot open ${label} files. Download it to see it.`
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileIcon />
        </EmptyMedia>
        <EmptyTitle>No preview for this file</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<a href={`${address}?download`} />}>
          <DownloadIcon data-icon="inline-start" />
          Download
        </Button>
      </EmptyContent>
    </Empty>
  )
}
