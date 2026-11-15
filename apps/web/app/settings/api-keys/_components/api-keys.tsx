"use client"

import { CloudOffIcon, KeyRoundIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { ScreenActions, ScreenDescription, ScreenEmpty, ScreenHeader, ScreenRow, ScreenRows, ScreenRowSkeleton, ScreenTitle } from "@/components/screen"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useApiKeys, useRevokeApiKey, type ApiKey } from "@/hooks/api-keys"

import { CreateKeyDialog } from "./create-key-dialog"

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" })

export function ApiKeys() {
  const { apiKeys, error, isLoading } = useApiKeys()

  return (
    <>
      <ScreenHeader>
        <ScreenTitle>API keys</ScreenTitle>
        <ScreenDescription>Keys for connecting your own tools to your organization.</ScreenDescription>
        <ScreenActions>
          <CreateKeyDialog />
        </ScreenActions>
      </ScreenHeader>
      {isLoading && (
        <ScreenRows>
          {Array.from({ length: 3 }, (_, index) => (
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
            <EmptyTitle>Your keys did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {apiKeys?.length === 0 && (
        <ScreenEmpty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>No keys yet</EmptyTitle>
            <EmptyDescription>Create one to call Persona from your own tools.</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {!!apiKeys?.length && (
        <ScreenRows>
          {apiKeys.map((apiKey) => (
            <KeyRow key={apiKey.id} apiKey={apiKey} />
          ))}
        </ScreenRows>
      )}
    </>
  )
}

// Revoke asks first. The dialog stays open, its button busy, until the server answers.
function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const revoke = useRevokeApiKey()
  const [confirming, setConfirming] = useState(false)

  async function revokeKey() {
    await revoke.trigger(apiKey.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.add({ title: `Revoked “${apiKey.name}”`, type: "success" })
      },
    })
  }

  return (
    <ScreenRow>
      <ItemMedia>
        <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <KeyRoundIcon className="size-4" />
        </span>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{apiKey.name}</ItemTitle>
        <ItemDescription>
          {apiKey.keyPrefix}… · Created {DATE.format(new Date(apiKey.createdAt))}
          {apiKey.lastUsedAt && ` · Last used ${DATE.format(new Date(apiKey.lastUsedAt))}`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              <Trash2Icon />
              Revoke key
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke “{apiKey.name}”?</AlertDialogTitle>
              <AlertDialogDescription>Anything still using this key stops working right away. You can&apos;t bring it back, so create a new key instead.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoke.isMutating}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={revoke.isMutating} onClick={revokeKey}>
                {revoke.isMutating && <Spinner data-icon="inline-start" />}
                {revoke.isMutating ? "Revoking…" : "Revoke key"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ItemActions>
    </ScreenRow>
  )
}
