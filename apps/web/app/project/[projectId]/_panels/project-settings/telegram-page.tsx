"use client"

import { CloudOffIcon, EllipsisIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import { TelegramAppIcon } from "@/components/icons"
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
import { useRemoveTelegramBot, useTelegramBots, type TelegramBot } from "@/hooks/telegram"

import { usePanels } from "../../_hooks/use-panels"
import { AddBotPanel } from "./add-bot-panel"

// The bots this project answers as: its own, then Persona's shared one. Add a bot opens over it (&add=bot).
export function TelegramPage({ project }: { project: Project }) {
  const panels = usePanels()
  const { shared, bots, error, isLoading } = useTelegramBots(project.id)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Telegram</SectionTitle>
        <SectionDescription>The bots this project answers as.</SectionDescription>
        <SectionAction>
          <Button size="sm" onClick={() => panels.openAdd("bot")}>
            <PlusIcon data-icon="inline-start" />
            Add a bot
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
            <EmptyTitle>The bots did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {(!!bots?.length || !!shared) && (
        <ScreenRows>
          {bots?.map((bot) => (
            <BotRow key={bot.id} projectId={project.id} bot={bot} />
          ))}
          {shared && (
            <ScreenRow>
              <ItemMedia variant="image">
                <TelegramAppIcon className="size-full" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>@{shared.username}</ItemTitle>
                <ItemDescription>Persona&apos;s bot, open to every project</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge>Shared</Badge>
              </ItemActions>
            </ScreenRow>
          )}
        </ScreenRows>
      )}
      {bots?.length === 0 && !shared && (
        <ScreenEmpty>
          <EmptyHeader>
            <EmptyTitle>No bots yet</EmptyTitle>
            <EmptyDescription>Add a bot, and every persona in this project can answer as it.</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {panels.add.data === "bot" && <AddBotPanel project={project} open={panels.add.open} onOpenChange={(open) => !open && panels.closeAdd()} />}
    </Section>
  )
}

// The project's own bot: its menu holds Remove, which asks first
function BotRow({ projectId, bot }: { projectId: string; bot: TelegramBot }) {
  const remove = useRemoveTelegramBot(projectId)
  const [confirming, setConfirming] = useState(false)

  function removeBot() {
    void remove.trigger(bot.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Removed @${bot.username}`, type: "success" })
      },
    })
  }

  return (
    <ScreenRow>
      <ItemMedia variant="image">
        <TelegramAppIcon className="size-full" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>@{bot.username}</ItemTitle>
        <ItemDescription>Shows as {bot.name}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More for @${bot.username}`} />}>
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove @{bot.username}?</AlertDialogTitle>
            <AlertDialogDescription>Every persona in this project stops answering as it, and its chats go quiet. Adding it again needs its token.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={remove.isMutating} onClick={removeBot}>
              {remove.isMutating && <Spinner data-icon="inline-start" />}
              {remove.isMutating ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScreenRow>
  )
}
