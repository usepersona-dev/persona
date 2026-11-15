"use client"

import type { OrganizationResource } from "@clerk/nextjs/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserPlusIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useInviteMember } from "@/hooks/invitations"

const Schema = z.object({
  email: z.email("Enter an email address."),
})

type Values = z.infer<typeof Schema>

// Our server has Clerk email the invitation, with a link to our sign-up page. The dialog stays open, its button busy, until it answers. Disabled until the organization loads.
export function InviteDialog({ organization, onInvited }: { organization?: OrganizationResource; onInvited?: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { email: "" } })
  const invite = useInviteMember()

  const sending = form.formState.isSubmitting

  async function send(values: Values) {
    const invited = await invite.trigger(values)
    if (!invited) return
    await onInvited?.()
    setOpen(false)
    toast.add({ title: `Invited ${values.email}`, type: "success" })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={(stillOpen) => !stillOpen && form.reset()}>
      <DialogTrigger render={<Button disabled={!organization} />}>
        <UserPlusIcon />
        Invite
      </DialogTrigger>
      <DialogContent>
        <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(send)}>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>They&apos;ll get an email with a link to join {organization?.name}.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input {...field} id="invite-email" type="email" aria-invalid={fieldState.invalid} placeholder="teammate@example.com" autoComplete="email" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />} disabled={sending}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={sending}>
              {sending && <Spinner data-icon="inline-start" />}
              {sending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
