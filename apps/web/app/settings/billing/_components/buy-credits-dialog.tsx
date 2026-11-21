"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useBuyCredits, type Billing } from "@/hooks/billing"

import { formatCredits, formatDollars, formatTopUp } from "../_lib/format"

type Props = { topUp: NonNullable<Billing["topUp"]> }

// The packs to buy. The saved card pays at once, so this is the confirmation; a card that fails goes to Stripe's page for its invoice
export function BuyCreditsDialog({ open, onOpenChange, topUp }: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <BuyCreditsForm topUp={topUp} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

// Mounted on each open, so it starts from the second pack on offer
function BuyCreditsForm({ topUp, onDone }: Props & { onDone: () => void }) {
  const buy = useBuyCredits()
  const [credits, setCredits] = useState(topUp.amounts[1])

  async function confirm() {
    const bought = await buy.trigger({ credits })
    if (!bought) return
    if (bought.url) return window.location.assign(bought.url)
    toast.add({ title: `${formatCredits(credits)} credits added`, type: "success" })
    onDone()
  }

  function label(amount: number) {
    return formatTopUp(amount, topUp.creditUsd)
  }

  return (
    <div className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Buy credits</DialogTitle>
        <DialogDescription>Credits you buy are good for 12 months.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="buy-credits-pack">Pack</FieldLabel>
        <Select value={credits} onValueChange={(value) => setCredits(Number(value))}>
          <SelectTrigger id="buy-credits-pack" className="w-full">
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
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />} disabled={buy.isMutating}>
          Cancel
        </DialogClose>
        <Button disabled={buy.isMutating} onClick={confirm}>
          {buy.isMutating && <Spinner data-icon="inline-start" />}
          Buy for {formatDollars(credits * topUp.creditUsd)}
        </Button>
      </DialogFooter>
    </div>
  )
}
