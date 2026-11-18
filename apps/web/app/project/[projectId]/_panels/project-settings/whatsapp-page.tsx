"use client"

import { CloudOffIcon, EllipsisIcon, MailIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { WhatsappAppIcon } from "@/components/icons"
import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { Project } from "@/hooks/projects"
import { useMetaLines, useRemoveMetaLine, type MetaLine } from "@/hooks/whatsapp-meta"

// WhatsApp: the project's own numbers, then Persona's shared one. A number of the project's own comes by asking us: Contact us writes an email, and we connect the number
export function WhatsappPage({ project }: { project: Project }) {
  const { shared, lines, error, isLoading } = useMetaLines(project.id)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>WhatsApp</SectionTitle>
        <SectionDescription>The numbers this project answers on. For a number of your own, write to us.</SectionDescription>
        <SectionAction>
          <Button size="sm" variant="outline" nativeButton={false} render={<a href={contactHref(project)} />}>
            <MailIcon data-icon="inline-start" />
            Contact us
          </Button>
        </SectionAction>
      </SectionHeader>
      {isLoading && (
        <ScreenRows>
          {Array.from({ length: 2 }, (_, index) => (
            <ScreenRowSkeleton key={index} />
          ))}
        </ScreenRows>
      )}
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>The numbers did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {lines && (
        <ScreenRows>
          {lines.map((line) => (
            <MetaLineRow key={line.id} projectId={project.id} line={line} />
          ))}
          {shared && <SharedRow number={shared.number} />}
        </ScreenRows>
      )}
    </Section>
  )
}

// An email to us that names the project, so we know where to connect the number
function contactHref(project: Project) {
  const subject = encodeURIComponent(`Our own WhatsApp number: ${project.name}`)
  const body = encodeURIComponent(`Project: ${project.name} (${project.id})`)
  const href = `mailto:info@usepersona.dev?subject=${subject}&body=${body}`
  return href
}

// A number in the person's own Meta account, answered through their own app. Its menu holds Remove, which asks first; the number stays theirs at Meta
function MetaLineRow({ projectId, line }: { projectId: string; line: MetaLine }) {
  const remove = useRemoveMetaLine(projectId)
  const [removing, setRemoving] = useState(false)

  function removeLine() {
    void remove.trigger(line.id, {
      onSuccess: () => {
        setRemoving(false)
        toast.add({ title: `Removed ${line.number}`, type: "success" })
      },
    })
  }

  return (
    <ScreenRow>
      <ItemMedia variant="image">
        <WhatsappAppIcon className="size-full" />
      </ItemMedia>
      <ItemContent className="min-w-32">
        <ItemTitle className="tabular-nums">{line.number}</ItemTitle>
        <ItemDescription>Your number, on your Meta app</ItemDescription>
      </ItemContent>
      <ItemActions className="ms-auto">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label={`More for ${line.number}`} />}>
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
              <Trash2Icon />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {line.number}?</AlertDialogTitle>
            <AlertDialogDescription>Its chats stop reaching your personas. The number stays in your Meta account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={remove.isMutating} onClick={removeLine}>
              {remove.isMutating && <Spinner data-icon="inline-start" />}
              {remove.isMutating ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScreenRow>
  )
}

// Persona's shared number, open to every project
function SharedRow({ number }: { number: string }) {
  return (
    <ScreenRow>
      <ItemMedia variant="image">
        <WhatsappAppIcon className="size-full" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="tabular-nums">{number}</ItemTitle>
        <ItemDescription>Persona&apos;s number, open to every project</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge>Shared</Badge>
      </ItemActions>
    </ScreenRow>
  )
}
