import { z } from "zod"

import * as autumn from "@/lib/autumn"
import { err, ok, validate } from "@/lib/errors"
import { db } from "@/prisma/db"
import type { Caller } from "@/usecases/auth"

const TOP_UP_CREDITS = [50, 100, 250, 500]

const subscribeInput = z.object({ plan: z.string() })
const creditsInput = z.number().refine((credits) => TOP_UP_CREDITS.includes(credits), "Pick one of the amounts.")
const buyCreditsInput = z.object({ credits: creditsInput })
const autoReloadInput = z.object({ autoReload: z.object({ enabled: z.boolean(), below: z.number().int().min(1).max(1_000), credits: creditsInput }) })

// The Billing page's read, live from Autumn: the organization's plan, its credits by source, the free credits every organization gets, the plans to pick from, each with what picking it would do (Unlimited is never listed), how credits are sold, and auto-reload. Unlimited's Infinity credits reach the page as null, and the page reads no credits for it
export async function getBilling(caller: Caller) {
  const organization = await db.orm.public.Organization.where({ orgId: caller.orgId }).select("name").first()
  if (!organization) return err("not_found", "This organization does not exist.")

  const customer = await autumn.readCustomer(caller.orgId, organization.name)
  if (!customer.ok) return customer

  const plans = await autumn.listPlans(caller.orgId)
  if (!plans.ok) return plans

  const { planKey, periodEnd, downgradeTo, credits, autoReload } = customer.value
  const plan = plans.value.find((one) => one.key === planKey)
  if (!plan) throw new Error(`The plan ${planKey} is not on Autumn.`)

  const free = plans.value.find((one) => one.key === "free")
  const offered = plans.value.filter((one) => one.key !== "unlimited")

  let topUp = null
  if (plan.sellsTopUps) topUp = { amounts: TOP_UP_CREDITS, creditUsd: plan.creditUsd }

  const billing = { plan: { key: planKey, name: plan.name, usd: plan.usd, periodEnd, downgradeTo }, credits, freeCredits: free?.credits ?? 0, plans: offered, topUp, autoReload }
  return ok(billing)
}

// Saves the caller's auto-reload: when its credits fall below a line, the saved card buys a pack. Autumn fires it only on a plan with a price for credits, so never on Free
export async function updateAutoReload(caller: Caller, input: z.input<typeof autoReloadInput>) {
  const parsed = validate(autoReloadInput, input)
  if (!parsed.ok) return parsed
  const { autoReload } = parsed.value

  const saved = await autumn.setAutoReload(caller.orgId, autoReload)
  if (!saved.ok) return saved
  return ok({ autoReload })
}

// Changes the caller's plan, and answers with a page to send the person to when a payment needs them (Stripe Checkout from Free).
// A bigger plan starts now with the price difference charged at once; a smaller one at the period's end, so the period keeps what it paid for. Free ends the paid plan at the period's end, as the Free plan itself never goes away. Autumn decides which is bigger. A yearly plan never moves to a monthly one. Unlimited is given by hand
export async function changePlan(caller: Caller, input: z.input<typeof subscribeInput>) {
  const parsed = validate(subscribeInput, input)
  if (!parsed.ok) return parsed
  const { plan } = parsed.value

  if (plan === "unlimited") return err("invalid", "Unlimited plan is not available for change.")

  if (plan === "free") {
    const paid = await readPaidPlan(caller)
    if (!paid.ok) return paid

    const canceled = await autumn.cancelPlan(caller.orgId, paid.value)
    if (!canceled.ok) return canceled
    return ok({ url: null })
  }

  const customer = await autumn.readCustomer(caller.orgId)
  if (!customer.ok) return customer

  const onYearly = customer.value.planKey.endsWith("_yearly")
  const toMonthly = plan.endsWith("_monthly")
  if (onYearly && toMonthly) return err("invalid", "A yearly plan cannot move to a monthly one. Switch to Free, then pick a monthly plan when your year ends.")

  const plans = await autumn.listPlans(caller.orgId)
  if (!plans.ok) return plans

  const target = plans.value.find((one) => one.key === plan)
  if (!target) return err("invalid", "Pick one of the plans.")

  const upgrade = target.attachAction === "upgrade"
  const returnUrl = new URL("/settings/billing", process.env.APP_URL).toString()
  const url = await autumn.attachPlan(caller.orgId, plan, returnUrl, upgrade)
  if (!url.ok) return url
  return ok({ url: url.value })
}

// Drops the caller's pending downgrade, so its plan stays
export async function cancelDowngrade(caller: Caller) {
  const paid = await readPaidPlan(caller)
  if (!paid.ok) return paid

  const kept = await autumn.keepPlan(caller.orgId, paid.value)
  if (!kept.ok) return kept
  return ok({ plan: paid.value })
}

// Stripe's page for the organization's cards and invoices
export async function createPortalLink(caller: Caller) {
  const returnUrl = new URL("/settings/billing", process.env.APP_URL).toString()
  const url = await autumn.createPortalLink(caller.orgId, returnUrl)
  if (!url.ok) return url
  return ok({ url: url.value })
}

// Buys a pack of credits on the caller's paid plan, on the saved card. Answers with a page to send the person to when a payment needs them. They end 12 months after the purchase, and usage takes them after the month's credits
export async function buyCredits(caller: Caller, input: z.input<typeof buyCreditsInput>) {
  const parsed = validate(buyCreditsInput, input)
  if (!parsed.ok) return parsed

  const paid = await readPaidPlan(caller)
  if (!paid.ok) return paid

  const url = await autumn.buyCredits(caller.orgId, paid.value, parsed.value.credits)
  if (!url.ok) return url
  return ok({ url: url.value })
}

// The key of the caller's paid plan
async function readPaidPlan(caller: Caller) {
  const customer = await autumn.readCustomer(caller.orgId)
  if (!customer.ok) return customer

  if (customer.value.planKey === "free") return err("invalid", "This organization has no paid plan.")
  return ok(customer.value.planKey)
}
