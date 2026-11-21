import assert from "node:assert/strict"
import { afterAll, test } from "vitest"

import { Autumn } from "autumn-js"

import { db } from "@/prisma/db"
import { buyCredits, cancelDowngrade, changePlan, createPortalLink, getBilling, updateAutoReload } from "@/usecases/billing"
import { chargeUsage, hasCredits } from "@/usecases/credits"

// Billing end to end against the Autumn sandbox in .env.local: each test starts a throwaway organization, and at the end all of them go away, in Autumn and in the database.
// A script cannot pay on Stripe Checkout, so a paid plan starts by invoice. It refuses anything but a test key. Run it alone with pnpm test:integration billing
const key = process.env.AUTUMN_SECRET_KEY ?? ""
if (!key.startsWith("am_sk_test_")) throw new Error("The billing tests run only with an Autumn test key.")

const autumn = new Autumn({ secretKey: key })
const organizations: { orgId: string; userId: string }[] = []

afterAll(async () => {
  for (const { orgId, userId } of organizations) {
    await autumn.customers.delete({ customerId: orgId, deleteInStripe: true }).catch(() => undefined)
    await db.orm.public.Usage.where({ orgId }).deleteAll()
    await db.orm.public.Organization.where({ orgId }).deleteAll()
    await db.orm.public.User.where({ authId: userId }).deleteAll()
  }
  await db.close()
})

test("Free: the page reads 25 credits, usage takes them to the last fraction, and at 0 turns stop", async () => {
  const org = await startOrganization("free")

  const start = await readBilling(org)
  assert.equal(start.plan.key, "free")
  assert.equal(start.plan.downgradeTo, null)
  assert.deepEqual(start.credits.pools, [{ name: "free", max: 25, left: 25 }, { name: "plan", max: 0, left: 0 }, { name: "bought", max: 0, left: 0 }, { name: "gift", max: 0, left: 0 }])
  assert.equal(start.credits.left, 25)
  assert.equal(start.freeCredits, 25)
  assert.ok(new Date(start.credits.resetsAt).getTime() > Date.now())
  assert.equal(start.plans.length, 7)
  assert.equal(start.plans.some((one) => one.key === "unlimited"), false)

  const id = crypto.randomUUID()
  assert.deepEqual(await charge(org, id, 20.5), { ok: true, value: 1 })
  assert.equal((await waitForCredits(org, 4.5)).left, 4.5)

  assert.deepEqual(await charge(org, id, 20.5), { ok: true, value: 0 })

  await charge(org, crypto.randomUUID(), 4.4)
  assert.equal((await waitForCredits(org, 0.1)).left, 0.1)
  assert.deepEqual(await hasCredits(org.caller), { ok: true, value: true })

  await charge(org, crypto.randomUUID(), 5)
  await waitForCredits(org, 0)
  assert.deepEqual(await hasCredits(org.caller), { ok: true, value: false })

  const rows = await db.orm.public.Usage.where({ orgId: org.orgId }).all()
  assert.equal(rows.length, 3)
  assert.equal(rows.reduce((sum, row) => sum + Number(row.credits), 0), 29.9)
})

test("A first turn makes the customer, on Free, and the Billing page fills in its name", async () => {
  const org = await startOrganization("first turn")

  assert.deepEqual(await hasCredits(org.caller), { ok: true, value: true })
  assert.deepEqual(await hasCredits(org.caller), { ok: true, value: true })
  assert.equal((await readBilling(org)).credits.left, 25)

  const customer = await autumn.customers.getOrCreate({ customerId: org.orgId })
  assert.equal(customer.name, "Billing test first turn")
})

test("From Free, a paid plan goes through Stripe Checkout", async () => {
  const org = await startOrganization("checkout")
  await readBilling(org)

  const changed = await changePlan(org.caller, { plan: "hobby_monthly" })
  assert.ok(changed.ok)
  assert.ok(changed.value.url)
  assert.equal(new URL(changed.value.url).host, "checkout.stripe.com")
  assert.equal((await readBilling(org)).plan.key, "free")
})

test("Paid: credits stack on Free, an upgrade keeps the month's usage, and a downgrade or Free waits and can be dropped", async () => {
  const org = await startOrganization("paid")
  await autumn.customers.getOrCreate({ customerId: org.orgId, email: "billing-test@example.com" })
  await autumn.billing.attach({ customerId: org.orgId, planId: "hobby_monthly", invoiceMode: { enabled: true, enablePlanImmediately: true } })

  const hobby = await readBilling(org)
  assert.equal(hobby.plan.key, "hobby_monthly")
  assert.equal(hobby.plan.name, "Hobby")
  assert.equal(hobby.plan.usd, 20)
  assert.equal(hobby.credits.max, 125)
  assert.deepEqual(hobby.credits.pools, [{ name: "free", max: 25, left: 25 }, { name: "plan", max: 100, left: 100 }, { name: "bought", max: 0, left: 0 }, { name: "gift", max: 0, left: 0 }])
  assert.equal(hobby.plans.find((one) => one.key === "pro_monthly")?.attachAction, "upgrade")

  await charge(org, crypto.randomUUID(), 80)
  const used = await waitForCredits(org, 45)
  assert.deepEqual(used.pools, [{ name: "free", max: 25, left: 0 }, { name: "plan", max: 100, left: 45 }, { name: "bought", max: 0, left: 0 }, { name: "gift", max: 0, left: 0 }])

  const upgraded = await changePlan(org.caller, { plan: "pro_monthly" })
  assert.ok(upgraded.ok)
  const pro = await readBilling(org)
  assert.equal(pro.plan.key, "pro_monthly")
  assert.deepEqual(pro.credits.pools, [{ name: "free", max: 25, left: 0 }, { name: "plan", max: 500, left: 445 }, { name: "bought", max: 0, left: 0 }, { name: "gift", max: 0, left: 0 }])
  assert.equal(pro.plans.find((one) => one.key === "hobby_monthly")?.attachAction, "downgrade")
  assert.equal(pro.plans.find((one) => one.key === "hobby_yearly")?.attachAction, "upgrade")

  const downgraded = await changePlan(org.caller, { plan: "hobby_monthly" })
  assert.ok(downgraded.ok)
  const waiting = await readBilling(org)
  assert.equal(waiting.plan.key, "pro_monthly")
  assert.equal(waiting.plan.downgradeTo, "hobby_monthly")

  assert.ok((await cancelDowngrade(org.caller)).ok)
  assert.equal((await readBilling(org)).plan.downgradeTo, null)

  const stopping = await changePlan(org.caller, { plan: "free" })
  assert.deepEqual(stopping, { ok: true, value: { url: null } })
  const toFree = await readBilling(org)
  assert.equal(toFree.plan.key, "pro_monthly")
  assert.equal(toFree.plan.downgradeTo, "free")
  assert.ok(new Date(toFree.plan.periodEnd).getTime() > Date.now())

  assert.ok((await cancelDowngrade(org.caller)).ok)
  assert.equal((await readBilling(org)).plan.downgradeTo, null)

  const portal = await createPortalLink(org.caller)
  assert.ok(portal.ok)
  assert.equal(new URL(portal.value.url).host, "billing.stripe.com")
})

test("Yearly: a yearly plan never moves to a monthly one, and can still move up", async () => {
  const org = await startOrganization("yearly")
  await autumn.customers.getOrCreate({ customerId: org.orgId, email: "billing-test@example.com" })
  await autumn.billing.attach({ customerId: org.orgId, planId: "hobby_yearly", invoiceMode: { enabled: true, enablePlanImmediately: true } })

  for (const plan of ["hobby_monthly", "pro_monthly"]) {
    const refused = await changePlan(org.caller, { plan })
    assert.equal(refused.ok, false)
  }
  const stays = await readBilling(org)
  assert.equal(stays.plan.key, "hobby_yearly")
  assert.equal(stays.plan.downgradeTo, null)

  const upgraded = await changePlan(org.caller, { plan: "pro_yearly" })
  assert.ok(upgraded.ok)
  const pro = await readBilling(org)
  assert.equal(pro.plan.key, "pro_yearly")
})

test("Top-ups: only a paid plan buys credits, in our amounts; they add up, usage takes them last, and auto-reload saves", async () => {
  const org = await startOrganization("top-up")
  await autumn.customers.getOrCreate({ customerId: org.orgId, email: "billing-test@example.com" })

  const onFree = await readBilling(org)
  assert.equal(onFree.topUp, null)
  assert.equal((await buyCredits(org.caller, { credits: 100 })).ok, false)

  await autumn.billing.attach({ customerId: org.orgId, planId: "hobby_monthly", invoiceMode: { enabled: true, enablePlanImmediately: true } })
  const paid = await readBilling(org)
  assert.deepEqual(paid.topUp, { amounts: [50, 100, 250, 500], creditUsd: 0.2 })
  assert.equal((await buyCredits(org.caller, { credits: 120 })).ok, false)

  for (const credits of [100, 250]) assert.ok((await buyCredits(org.caller, { credits })).ok)
  const bought = await readBilling(org)
  assert.equal(bought.plan.key, "hobby_monthly")
  assert.deepEqual(bought.credits.pools, [{ name: "free", max: 25, left: 25 }, { name: "plan", max: 100, left: 100 }, { name: "bought", max: 350, left: 350 }, { name: "gift", max: 0, left: 0 }])

  await charge(org, crypto.randomUUID(), 160)
  const used = await waitForCredits(org, 315)
  assert.deepEqual(used.pools, [{ name: "free", max: 25, left: 0 }, { name: "plan", max: 100, left: 0 }, { name: "bought", max: 350, left: 315 }, { name: "gift", max: 0, left: 0 }])
  assert.deepEqual(await hasCredits(org.caller), { ok: true, value: true })

  assert.equal(bought.autoReload, null)
  for (const enabled of [true, false]) {
    const autoReload = { enabled, below: 25, credits: 100 }
    assert.ok((await updateAutoReload(org.caller, { autoReload })).ok)
    assert.deepEqual((await readBilling(org)).autoReload, autoReload)
  }
})

test("Unlimited: no credit limit, and no one can change to it", async () => {
  const org = await startOrganization("unlimited")
  await readBilling(org)

  const refused = await changePlan(org.caller, { plan: "unlimited" })
  assert.equal(refused.ok, false)
  await autumn.billing.attach({ customerId: org.orgId, planId: "unlimited" })

  const billing = await readBilling(org)
  assert.equal(billing.plan.key, "unlimited")
  assert.equal(billing.credits.left, Infinity)

  await charge(org, crypto.randomUUID(), 1)
  assert.deepEqual(await hasCredits(org.caller), { ok: true, value: true })
})

type Organization = { orgId: string; personaId: string; caller: { orgId: string; userId: string } }

// A throwaway organization with one persona, in the database only: its Autumn customer comes on the first read
async function startOrganization(label: string): Promise<Organization> {
  const orgId = `org_billing_test_${crypto.randomUUID()}`
  const userId = `user_billing_test_${crypto.randomUUID()}`
  organizations.push({ orgId, userId })

  await db.orm.public.Organization.create({ orgId, name: `Billing test ${label}`, members: [], invitations: [] })
  await db.orm.public.User.create({ authId: userId, organizationIds: [orgId], email: `${userId}@example.com` })
  const project = await db.orm.public.Project.create({ orgId, userId, name: "Billing test" })
  const persona = await db.orm.public.Persona.create({ projectId: project.id, orgId, name: "Billing test" })

  return { orgId, personaId: persona.id, caller: { orgId, userId } }
}

async function readBilling(org: Organization) {
  const billing = await getBilling(org.caller)
  assert.ok(billing.ok, JSON.stringify(billing))
  return billing.value
}

async function charge(org: Organization, id: string, credits: number) {
  const tokens = { model: "billing-test", provider: null, inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0, marketCost: null, gatewayCost: null }
  const charged = await chargeUsage({ id, personaId: org.personaId, credits, usage: { tokens } })
  return charged
}

// Autumn applies usage a moment after it comes, so this reads until the credits arrive
async function waitForCredits(org: Organization, left: number) {
  for (let tries = 0; tries < 60; tries += 1) {
    const { credits } = await readBilling(org)
    if (Math.abs(credits.left - left) < 0.001) return { ...credits, left: Math.round(credits.left * 1000) / 1000 }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`The credits did not reach ${left}.`)
}
