"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { useUpdateAutoReload, type Billing } from "@/hooks/billing"

import { formatCredits, formatTopUp, isReloadLine, parseCredits } from "../_lib/format"

const Schema = z.object({
  enabled: z.boolean(),
  below: z.string().refine((text) => isReloadLine(parseCredits(text)), "Type a whole number from 1 to 1,000."),
  credits: z.number(),
})

type Values = z.infer<typeof Schema>
type Props = { autoReload: Billing["autoReload"]; topUp: NonNullable<Billing["topUp"]> }

// Auto-reload's switch and two amounts: under a line of credits, the saved card buys a pack
export function AutoReloadDialog({ open, onOpenChange, autoReload, topUp }: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <AutoReloadForm autoReload={autoReload} topUp={topUp} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

// Mounted on each open, so it starts from the saved values, or off with 25 and the second pack on offer
function AutoReloadForm({ autoReload, topUp, onDone }: Props & { onDone: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { enabled: autoReload?.enabled ?? false, below: formatCredits(autoReload?.below ?? 25), credits: autoReload?.credits ?? topUp.amounts[1] } })
  const update = useUpdateAutoReload()
  const enabled = useWatch({ control: form.control, name: "enabled" })

  async function save(values: Values) {
    const below = parseCredits(values.below)
    const updated = await update.trigger({ autoReload: { enabled: values.enabled, below, credits: values.credits } })
    if (!updated) return

    let title = "Auto-reload off"
    if (values.enabled) title = "Auto-reload on"
    toast.add({ title, type: "success" })
    onDone()
  }

  function label(amount: number) {
    return formatTopUp(amount, topUp.creditUsd)
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(save)}>
      <DialogHeader>
        <DialogTitle>Auto-reload</DialogTitle>
        <DialogDescription>When your credits run low, buy more. Credits you buy are good for 12 months.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-5">
        <Controller
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel htmlFor="auto-reload-enabled">Reload automatically</FieldLabel>
              <Switch id="auto-reload-enabled" checked={field.value} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="below"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} data-disabled={!enabled}>
              <FieldLabel htmlFor="auto-reload-below">When credits fall below</FieldLabel>
              <InputGroup data-disabled={!enabled}>
                <InputGroupInput {...field} id="auto-reload-below" inputMode="numeric" autoComplete="off" disabled={!enabled} aria-invalid={fieldState.invalid} />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>credits</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="credits"
          render={({ field }) => (
            <Field data-disabled={!enabled}>
              <FieldLabel htmlFor="auto-reload-credits">Buy</FieldLabel>
              <Select value={field.value} onValueChange={(value) => field.onChange(Number(value))} disabled={!enabled}>
                <SelectTrigger id="auto-reload-credits" className="w-full">
                  <SelectValue>{label}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {topUp.amounts.map((amount) => (
                    <SelectItem key={amount} value={amount}>
                      {label(amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />} disabled={update.isMutating}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={update.isMutating}>
          {update.isMutating && <Spinner data-icon="inline-start" />}
          {update.isMutating ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}
