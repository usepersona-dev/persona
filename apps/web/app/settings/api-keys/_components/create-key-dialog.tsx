"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useCreateApiKey } from "@/hooks/api-keys"

// The server checks the same rules
const Schema = z.object({
  name: z.string().trim().min(1, "Give the key a name.").max(80, "Keep the name under 80 characters."),
})

type Values = z.infer<typeof Schema>

// Name a key, then see it in full, once. When the dialog has closed, it forgets the key and clears the form.
export function CreateKeyDialog() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState<string>()
  const [copied, setCopied] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: "" } })
  const create = useCreateApiKey()

  async function submit(values: Values) {
    const created = await create.trigger(values)
    if (!created) return
    toast.add({ title: `Created “${created.apiKey.name}”`, type: "success" })
    setKey(created.key)
  }

  async function copy() {
    if (!key) return
    await navigator.clipboard.writeText(key)
    setCopied(true)
  }

  function forget(stillOpen: boolean) {
    if (stillOpen) return
    form.reset()
    setKey(undefined)
    setCopied(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={forget}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        New API key
      </DialogTrigger>
      <DialogContent>
        {key ? (
          <>
            <DialogHeader>
              <DialogTitle>Save your key</DialogTitle>
              <DialogDescription>This is the only time you&apos;ll see the full key. Keep it somewhere safe.</DialogDescription>
            </DialogHeader>
            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted p-2 ps-4">
              <code className="ph-no-capture min-w-0 flex-1 truncate text-sm font-bold">{key}</code>
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <DialogClose render={<Button />}>Done</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(submit)}>
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>Name it so you can recognize it later. You&apos;ll see the full key once.</DialogDescription>
            </DialogHeader>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="key-name">Name</FieldLabel>
                  <Input {...field} id="key-name" aria-invalid={fieldState.invalid} placeholder="Production server" autoComplete="off" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />} disabled={create.isMutating}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={create.isMutating}>
                {create.isMutating && <Spinner data-icon="inline-start" />}
                {create.isMutating ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
