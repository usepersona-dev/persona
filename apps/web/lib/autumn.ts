import { Autumn, AutumnError, type Customer } from "autumn-js"

import { err, ok } from "@/lib/errors"

const CREDITS = "credits"
// Autumn's check asks for one whole credit by default, and a turn may start with any credits left
const ANY_CREDITS = 0.01
const POOLS = ["free", "plan", "bought"]

// Autumn for an organization's billing: the organization is one Autumn customer under its own id, autumn.config.ts holds the plans, and Autumn keeps the balances and runs Stripe. If Autumn cannot be reached, its SDK lets check and track through
function autumnClient() {
  const secretKey = process.env.AUTUMN_SECRET_KEY
  if (!secretKey) throw new Error("AUTUMN_SECRET_KEY is not set.")

  const client = new Autumn({ secretKey })
  return client
}

// The organization's plan, credits and auto-reload. Autumn makes the customer on the first call, on the Free plan. A name given later fills in, and so does the email receipt for each charge, so a customer has it on from its first read
export async function readCustomer(orgId: string, name?: string) {
  try {
    const customer = await autumnClient().customers.getOrCreate({ customerId: orgId, name, sendEmailReceipts: true })
    const credits = creditsOf(customer)
    const plan = planOf(customer, credits.resetsAt)
    const autoReload = autoReloadOf(customer)
    return ok({ ...plan, credits, autoReload })
  } catch (error) {
    return refused(error)
  }
}

// Whether the organization has any credits left, or no limit
export async function checkCredits(orgId: string) {
  try {
    const checked = await autumnClient().check({ customerId: orgId, featureId: CREDITS, requiredBalance: ANY_CREDITS })
    return ok(checked.allowed)
  } catch (error) {
    return refused(error)
  }
}

// Takes credits from the organization's balance a moment later, with the persona's id on the record. Usage past the balance stops at 0 and counts against nothing
export async function trackCredits(orgId: string, personaId: string, credits: number) {
  try {
    await autumnClient().track({ customerId: orgId, featureId: CREDITS, value: credits, properties: { personaId } })
    return ok(undefined)
  } catch (error) {
    return refused(error)
  }
}

// Every plan, with what attaching it would do for this customer, and whether it sells credits to top up: autumn.config.ts gives that price to the paid plans only.
export async function listPlans(orgId: string) {
  try {
    const plans = await autumnClient().plans.list({ customerId: orgId })
    const list = plans.list.map((plan) => {
      const monthly = plan.items.find((one) => one.featureId === CREDITS && !one.price)
      const pack = plan.items.find((one) => one.featureId === CREDITS && one.price?.interval === "one_off")
      const sellsTopUps = pack !== undefined
      const creditUsd = (pack?.price?.amount ?? 0) / (pack?.price?.billingUnits ?? 1)
      return { key: plan.id, name: plan.name, usd: plan.price?.amount ?? 0, credits: monthly?.included ?? 0, sellsTopUps, creditUsd, attachAction: plan.customerEligibility?.attachAction ?? "none" }
    })
    return ok(list)
  } catch (error) {
    return refused(error)
  }
}

// Puts the customer on a plan. A bigger one starts now and is charged the whole price difference at once, so a last-day upgrade pays for the credits it gets, and the billing date stays; a smaller one waits for the period's end. With keepUsage, the new plan's credits count what this month already used, which Autumn allows only on an upgrade. Answers with a page to send the person to when a payment needs them (Stripe Checkout while there is no card), or null
export async function attachPlan(orgId: string, planKey: string, returnUrl: string, keepUsage: boolean) {
  try {
    const attached = await autumnClient().billing.attach({ customerId: orgId, planId: planKey, redirectMode: "if_required", successUrl: returnUrl, carryOverUsages: { enabled: keepUsage }, prorationBehavior: "bill_difference" })
    return ok(attached.paymentUrl)
  } catch (error) {
    return refused(error)
  }
}

// Buys credits on the customer's plan: the saved card pays at once, and they never reset. Each call adds its quantity, as the price is one-off. Answers with a page to send the person to when a payment needs them (a card that fails), or null
export async function buyCredits(orgId: string, planKey: string, credits: number) {
  try {
    const bought = await autumnClient().billing.update({ customerId: orgId, planId: planKey, featureQuantities: [{ featureId: CREDITS, quantity: credits }], redirectMode: "if_required" })
    return ok(bought.paymentUrl)
  } catch (error) {
    return refused(error)
  }
}

// Saves auto-reload, which is Autumn's auto top-up. After each track Autumn looks at the balance and, under the line, charges the saved card at the price on the customer's plan, so it never fires on Free
export async function setAutoReload(orgId: string, autoReload: { enabled: boolean; below: number; credits: number }) {
  try {
    const autoTopups = [{ featureId: CREDITS, enabled: autoReload.enabled, threshold: autoReload.below, quantity: autoReload.credits }]
    await autumnClient().customers.update({ customerId: orgId, billingControls: { autoTopups } })
    return ok(undefined)
  } catch (error) {
    return refused(error)
  }
}

// Ends the plan when its billing period ends
export async function cancelPlan(orgId: string, planKey: string) {
  try {
    await autumnClient().billing.update({ customerId: orgId, planId: planKey, cancelAction: "cancel_end_of_cycle" })
    return ok(undefined)
  } catch (error) {
    return refused(error)
  }
}

// Drops the plan's waiting cancellation or downgrade, so the plan stays
export async function keepPlan(orgId: string, planKey: string) {
  try {
    await autumnClient().billing.update({ customerId: orgId, planId: planKey, cancelAction: "uncancel" })
    return ok(undefined)
  } catch (error) {
    return refused(error)
  }
}

// Stripe's own page for the organization's cards and invoices
export async function createPortalLink(orgId: string, returnUrl: string) {
  try {
    const portal = await autumnClient().billing.openCustomerPortal({ customerId: orgId, returnUrl })
    return ok(portal.url)
  } catch (error) {
    return refused(error)
  }
}

// The customer's credits, each source a pool: Autumn keeps a row per purchase, so a pool adds up its rows. Unlimited has no limit. A customer with no balance means autumn.config.ts was not pushed, which is a fault
function creditsOf(customer: Customer) {
  const balance = customer.balances[CREDITS]
  if (!balance) throw new Error("Autumn has no credits for this customer. Push autumn.config.ts.")

  const resetsAt = new Date(balance.nextResetAt ?? Date.now()).toISOString()
  if (balance.unlimited) return { max: Infinity, left: Infinity, pools: [], resetsAt }

  const rows = (balance.breakdown ?? []).map((one) => ({ name: poolName(one), max: one.includedGrant + one.prepaidGrant, left: one.remaining }))
  const pools = POOLS.map((name) => {
    const ofPool = rows.filter((row) => row.name === name)
    const max = ofPool.reduce((sum, row) => sum + row.max, 0)
    const left = ofPool.reduce((sum, row) => sum + row.left, 0)
    return { name, max, left }
  })

  return { max: balance.granted, left: balance.remaining, pools, resetsAt }
}

// Autumn's prepaid grant is what was bought. Credits bought outlive a plan change, and their row then has no plan
function poolName(row: { planId: string | null; prepaidGrant: number }) {
  if (row.planId === "free") return "free"
  if (row.planId === null) return "bought"
  if (row.prepaidGrant > 0) return "bought"
  return "plan"
}

function autoReloadOf(customer: Customer) {
  const saved = customer.billingControls.autoTopups?.find((one) => one.featureId === CREDITS)
  if (!saved) return null
  return { enabled: saved.enabled ?? false, below: saved.threshold, credits: saved.quantity }
}


// The customer's plan: its active paid plan, or Free when it has none. A plan that waits for the period's end shows as downgradeTo, and a canceled plan waits for Free. Free has no period of its own, so it ends when its credits reset
function planOf(customer: Customer, resetsAt: string) {
  const paid = customer.subscriptions.find((one) => one.status === "active" && one.planId !== "free")
  const scheduled = customer.subscriptions.find((one) => one.status === "scheduled")

  let downgradeTo = scheduled?.planId ?? null
  if (!scheduled && paid?.canceledAt) downgradeTo = "free"

  let periodEnd = resetsAt
  if (paid?.currentPeriodEnd) periodEnd = new Date(paid.currentPeriodEnd).toISOString()

  const plan = { planKey: paid?.planId ?? "free", periodEnd, downgradeTo }
  return plan
}

// The SDK throws on every answer that is not ok. A refusal (a 4xx, such as a missing customer) comes back with Autumn's own words; any other failure throws on
function refused(error: unknown) {
  if (!(error instanceof AutumnError)) throw error
  if (error.statusCode >= 500) throw error

  const answer: { message?: string } = JSON.parse(error.body)
  const message = answer.message ?? error.message
  if (error.statusCode === 404) return err("not_found", message)
  return err("invalid", message)
}
