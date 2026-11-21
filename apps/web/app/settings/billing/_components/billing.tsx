"use client"

import { ArrowUpRightIcon, CheckIcon, CloudOffIcon } from "lucide-react"
import { useState } from "react"

import { ScreenActions, ScreenDescription, ScreenEmpty, ScreenHeader, ScreenTitle } from "@/components/screen"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBilling, useCancelDowngrade, useChangePlan, useCreatePortalLink, type Billing as Account } from "@/hooks/billing"
import { cn } from "@/lib/utils"

import { formatCredits, formatDollars } from "../_lib/format"
import { AutoReloadDialog } from "./auto-reload-dialog"
import { BuyCreditsDialog } from "./buy-credits-dialog"

type Plan = Account["plans"][number]
type Period = "monthly" | "yearly"

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" })

// The organization's billing on a page wider than the other settings: one card for its plan and this month's credits, one for buying more, then our paid plans as cards, monthly or yearly. The card and the invoices are on Stripe's page.
export function Billing() {
  const { billing, error, isLoading } = useBilling()

  return (
    <div data-wide className="contents">
      <ScreenHeader>
        <ScreenTitle>Billing</ScreenTitle>
        <ScreenDescription>Your plan, credits and invoices.</ScreenDescription>
        {billing && billing.plan.usd > 0 && (
          <ScreenActions>
            <PortalButton label="Manage" variant="outline" size="sm" />
          </ScreenActions>
        )}
      </ScreenHeader>
      {isLoading && <Loading />}
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>Billing did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {billing && <Summary billing={billing} />}
      {billing?.topUp && <TopUps billing={billing} topUp={billing.topUp} />}
      {billing && billing.plan.key !== "unlimited" && <Plans billing={billing} />}
    </div>
  )
}

function PortalButton({ label, ...props }: { label: string } & React.ComponentProps<typeof Button>) {
  const portal = useCreatePortalLink()

  async function open() {
    const link = await portal.trigger()
    if (!link) return
    window.location.assign(link.url)
  }

  return (
    <Button disabled={portal.isMutating} onClick={open} {...props}>
      {portal.isMutating && <Spinner data-icon="inline-start" />}
      {label}
      {!portal.isMutating && <ArrowUpRightIcon data-icon="inline-end" />}
    </Button>
  )
}

function Summary({ billing }: { billing: Account }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{billing.plan.name}</CardTitle>
        <CardDescription className="tabular-nums">
          <PlanStatus billing={billing} />
        </CardDescription>
      </CardHeader>
      {billing.plan.key !== "unlimited" && (
        <CardContent>
          <Credits billing={billing} />
        </CardContent>
      )}
    </Card>
  )
}

function PlanStatus({ billing }: { billing: Account }) {
  const { plan } = billing
  const end = DATE.format(new Date(plan.periodEnd))
  const next = billing.plans.find((one) => one.key === plan.downgradeTo)
  const yearly = periodOf(plan.key) === "yearly"

  if (plan.key === "unlimited") return "No credit limit"
  if (plan.usd === 0) return `Free credits reset on ${DATE.format(new Date(billing.credits.resetsAt))}`
  if (next && yearly)
    return (
      <>
        <b>{formatDollars(plan.usd)}</b> a year · changes to {next.name} on {end}
      </>
    )
  if (next)
    return (
      <>
        <b>{formatDollars(plan.usd)}</b> a month · changes to {next.name} on {end}
      </>
    )
  if (yearly)
    return (
      <>
        <b>{formatDollars(plan.usd)}</b> a year · renews on {end}
      </>
    )
  return (
    <>
      <b>{formatDollars(plan.usd)}</b> a month · renews on {end}
    </>
  )
}

function KeepButton({ billing, next, end, label }: { billing: Account; next: Plan; end: string; label: React.ReactNode }) {
  const cancel = useCancelDowngrade()
  const [confirming, setConfirming] = useState(false)

  async function keep() {
    const kept = await cancel.trigger()
    if (!kept) return
    setConfirming(false)
    toast.add({ title: `You keep ${billing.plan.name}`, type: "success" })
  }

  return (
    <>
      <Button variant="link" className="h-auto p-0" onClick={() => setConfirming(true)}>
        {label}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your downgrade to {next.name}?</AlertDialogTitle>
            <AlertDialogDescription>You keep {billing.plan.name}, and it renews on {end}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isMutating}>Not now</AlertDialogCancel>
            <AlertDialogAction disabled={cancel.isMutating} onClick={keep}>
              {cancel.isMutating && <Spinner data-icon="inline-start" />}
              Keep {billing.plan.name}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Credits({ billing }: { billing: Account }) {
  const { credits } = billing
  const day = DATE.format(new Date(credits.resetsAt))
  const stopped = credits.left <= 0
  const free = credits.pools.filter((pool) => pool.name === "free")
  const plan = credits.pools.filter((pool) => pool.name === "plan" && pool.max > 0)
  const bought = credits.pools.filter((pool) => pool.name === "bought" && (billing.plan.usd > 0 || pool.max > 0))
  const gift = credits.pools.filter((pool) => pool.name === "gift" && pool.max > 0)

  let left = `${formatCredits(credits.left)} left`
  if (stopped) left = "Out of credits"

  let restart = "Upgrade to restart them now."
  if (billing.plan.usd > 0) restart = "Top up to restart them now."

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">Credits</span>
        <span className={cn("text-sm font-medium tabular-nums", stopped && "text-destructive")}>{left}</span>
      </div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {free.filter((pool) => pool.left > 0).map((pool) => <span key={pool.name} className="h-full bg-tone-olive-foreground" style={{ width: `${(pool.left / credits.max) * 100}%` }} />)}
        {plan.filter((pool) => pool.left > 0).map((pool) => <span key={pool.name} className="h-full bg-tone-plum-foreground" style={{ width: `${(pool.left / credits.max) * 100}%` }} />)}
        {bought.filter((pool) => pool.left > 0).map((pool) => <span key={pool.name} className="h-full bg-tone-clay-foreground" style={{ width: `${(pool.left / credits.max) * 100}%` }} />)}
        {gift.filter((pool) => pool.left > 0).map((pool) => <span key={pool.name} className="h-full bg-tone-ochre-foreground" style={{ width: `${(pool.left / credits.max) * 100}%` }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground tabular-nums">
        {free.map((pool) => (
          <li key={pool.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-tone-olive-foreground" />
            Free {formatCredits(pool.left)} of {formatCredits(pool.max)}
          </li>
        ))}
        {plan.map((pool) => (
          <li key={pool.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-tone-plum-foreground" />
            {billing.plan.name} {formatCredits(pool.left)} of {formatCredits(pool.max)}
          </li>
        ))}
        {bought.map((pool) => (
          <li key={pool.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-tone-clay-foreground" />
            Bought {formatCredits(pool.left)}
          </li>
        ))}
        {gift.map((pool) => (
          <li key={pool.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-tone-ochre-foreground" />
            Gift {formatCredits(pool.left)}
          </li>
        ))}
        <li className="ms-auto">Resets on {day}</li>
      </ul>
      {stopped && <p className="text-sm text-destructive">Your personas stopped until {day}. {restart}</p>}
    </div>
  )
}

// Only a plan with a price for credits shows this, so never Free. Buy and Auto-reload each open a dialog
function TopUps({ billing, topUp }: { billing: Account; topUp: NonNullable<Account["topUp"]> }) {
  const [buying, setBuying] = useState(false)
  const [reloading, setReloading] = useState(false)

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">Top up credits</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setReloading(true)}>
            Auto-reload
            {billing.autoReload?.enabled && <Badge variant="secondary">On</Badge>}
          </Button>
          <Button onClick={() => setBuying(true)}>Buy</Button>
        </div>
      </CardContent>
      <BuyCreditsDialog open={buying} onOpenChange={setBuying} topUp={topUp} />
      <AutoReloadDialog open={reloading} onOpenChange={setReloading} autoReload={billing.autoReload} topUp={topUp} />
    </Card>
  )
}

// A yearly plan never moves to a monthly one, so it shows only yearly plans, and no choice of period
function Plans({ billing }: { billing: Account }) {
  const onYearly = periodOf(billing.plan.key) === "yearly"
  const [period, setPeriod] = useState<Period>(periodOf(billing.plan.key))
  const free = billing.plans.find((one) => one.key === "free")
  const next = billing.plans.find((one) => one.key === billing.plan.downgradeTo)
  const end = DATE.format(new Date(billing.plan.periodEnd))

  function choose(values: string[]) {
    const [picked] = values
    if (picked === "monthly" || picked === "yearly") setPeriod(picked)
  }

  let title = "Change plan"
  if (billing.plan.key === "free") title = "Upgrade"

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl">{title}</h2>
        {!onYearly && (
          <ToggleGroup variant="outline" spacing={0} value={[period]} onValueChange={choose} aria-label="Billing period" className="grid grid-cols-2">
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="yearly" className="relative">
              Yearly
              <Badge className="absolute -top-2.5 -right-3">20%</Badge>
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HobbyCard billing={billing} period={period} />
        <BuilderCard billing={billing} period={period} />
        <ProCard billing={billing} period={period} />
      </div>
      {free && billing.plan.key !== "free" && !billing.plan.downgradeTo && (
        <p className="text-sm text-muted-foreground">
          Want to stop paying? <ChangeButton plan={free} label="switch to Free" title={`switch to Free on ${end}?`} description={`You keep ${billing.plan.name} until ${end}. Then you are on Free.`} action="Switch to Free" done={`Free starts on ${end}`} variant="link" className="h-auto p-0" /> when this period ends on {end}.
        </p>
      )}
      {next && (
        <p className="text-sm text-muted-foreground">
          You can <KeepButton billing={billing} next={next} end={end} label={<>cancel your downgrade </>} /> to  <i>{next.name}</i> before {end}.
        </p>
      )}
    </section>
  )
}

function HobbyCard({ billing, period }: { billing: Account; period: Period }) {
  const plan = billing.plans.find((one) => one.key === `hobby_${period}`)
  if (!plan) return null

  return (
    <PlanCard plan={plan} billing={billing}>
      <Feature>
        <b>{formatCredits(plan.credits)}</b> credits each month
      </Feature>
      <Feature>
        Plus <b>{formatCredits(billing.freeCredits)}</b> free credits each month
      </Feature>
      <Feature>Pay as you go</Feature>
      <Feature>Auto-reload</Feature>
      <Feature>Email support</Feature>
    </PlanCard>
  )
}

function BuilderCard({ billing, period }: { billing: Account; period: Period }) {
  const plan = billing.plans.find((one) => one.key === `builder_${period}`)
  if (!plan) return null

  return (
    <PlanCard plan={plan} billing={billing} badge="Popular">
      <Feature>
        <b>{formatCredits(plan.credits)}</b> credits each month
      </Feature>
      <Feature>
        Plus <b>{formatCredits(billing.freeCredits)}</b> free credits each month
      </Feature>
      <Feature>Pay as you go</Feature>
      <Feature>Auto-reload</Feature>
      <Feature>Priority support</Feature>
    </PlanCard>
  )
}

function ProCard({ billing, period }: { billing: Account; period: Period }) {
  const plan = billing.plans.find((one) => one.key === `pro_${period}`)
  if (!plan) return null

  return (
    <PlanCard plan={plan} billing={billing}>
      <Feature>
        <b>{formatCredits(plan.credits)}</b> credits each month
      </Feature>
      <Feature>
        Plus <b>{formatCredits(billing.freeCredits)}</b> free credits each month
      </Feature>
      <Feature>Pay as you go</Feature>
      <Feature>Auto-reload</Feature>
      <Feature>Dedicated support</Feature>
    </PlanCard>
  )
}

function PlanCard({ plan, billing, badge, children }: { plan: Plan; billing: Account; badge?: string; children: React.ReactNode }) {
  const current = plan.key === billing.plan.key

  let price = formatDollars(plan.usd)
  let per = "per month"
  if (periodOf(plan.key) === "yearly") price = formatDollars(plan.usd / 12)
  if (periodOf(plan.key) === "yearly") per = "per month, billed yearly"

  return (
    <Card className={cn("relative overflow-visible", current && "ring-2 ring-foreground/70")}>
      {badge && <Badge className="absolute -top-2.5 left-6">{badge}</Badge>}
      <CardHeader className="gap-3">
        <CardTitle>{plan.name}</CardTitle>
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-4xl leading-none tabular-nums">{price}</span>
          <span className="text-sm text-muted-foreground">{per}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex flex-col gap-2.5 text-sm">{children}</ul>
      </CardContent>
      <CardFooter className="flex-col items-stretch">
        <PlanButton plan={plan} billing={billing} />
      </CardFooter>
    </Card>
  )
}

function PlanButton({ plan, billing }: { plan: Plan; billing: Account }) {
  const end = DATE.format(new Date(billing.plan.periodEnd))

  let price = `${formatDollars(plan.usd)} a month`
  if (periodOf(plan.key) === "yearly") price = `${formatDollars(plan.usd)} a year`

  if (plan.key === billing.plan.key)
    return (
      <Button variant="secondary" disabled>
        Your plan
      </Button>
    )
  if (plan.key === billing.plan.downgradeTo)
    return (
      <Button variant="secondary" disabled>
        Your next plan
      </Button>
    )
  if (billing.plan.key === "free") return <CheckoutButton plan={plan} />
  if (plan.attachAction === "upgrade") return <ChangeButton plan={plan} label="Upgrade" title={`Upgrade to ${plan.name} now?`} description={`${plan.name} costs ${price}. You switch now and pay the price difference today.`} action="Upgrade now" done={`You are on ${plan.name}`} variant="outline" />
  return <ChangeButton plan={plan} label={`Switch to ${plan.name}`} title={`Switch to ${plan.name} on ${end}?`} description={`You keep ${billing.plan.name} until ${end}. Then ${plan.name} starts at ${price}.`} action="Switch" done={`${plan.name} starts on ${end}`} variant="outline" />
}

function CheckoutButton({ plan }: { plan: Plan }) {
  const change = useChangePlan()

  async function upgrade() {
    const changed = await change.trigger({ plan: plan.key })
    if (changed?.url) window.location.assign(changed.url)
  }

  return (
    <Button disabled={change.isMutating} onClick={upgrade}>
      {change.isMutating && <Spinner data-icon="inline-start" />}
      Upgrade
    </Button>
  )
}

function ChangeButton({ plan, label, title, description, action, done, ...props }: { plan: Plan; label: string; title: string; description: string; action: string; done: string } & React.ComponentProps<typeof Button>) {
  const change = useChangePlan()
  const [confirming, setConfirming] = useState(false)

  async function confirm() {
    const changed = await change.trigger({ plan: plan.key })
    if (!changed) return
    if (changed.url) return window.location.assign(changed.url)
    setConfirming(false)
    toast.add({ title: done, type: "success" })
  }

  return (
    <>
      <Button onClick={() => setConfirming(true)} {...props}>
        {label}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={change.isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={change.isMutating} onClick={confirm}>
              {change.isMutating && <Spinner data-icon="inline-start" />}
              {action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </li>
  )
}

function Loading() {
  return (
    <>
      <Card aria-hidden>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-28 rounded-sm" />
          <Skeleton className="h-3.5 w-56 rounded-sm" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-3 w-72 rounded-sm" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((index) => (
          <Card key={index}>
            <CardHeader className="gap-3">
              <Skeleton className="h-4 w-20 rounded-sm" />
              <Skeleton className="h-9 w-24 rounded-sm" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-3.5 w-44 rounded-sm" />
              <Skeleton className="h-3.5 w-40 rounded-sm" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function periodOf(key: string): Period {
  if (key.endsWith("_yearly")) return "yearly"
  return "monthly"
}
