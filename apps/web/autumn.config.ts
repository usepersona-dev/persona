import { atmn, feature, plan } from "atmn"

export const credits = feature({ featureId: "credits", name: "Credits", type: "metered", consumable: true })

// Credits to buy on top of a paid plan, by hand or with auto-reload, in steps of 50 at the plans' $0.20 a credit. Autumn's auto-reload charges at the price on the customer's plan, so every paid plan holds it and Free cannot buy. They never reset or expire, and usage takes them after the month's credits
const topUp = { featureId: credits.featureId, price: { amount: 10, billingUnits: 50, billingMethod: "prepaid", interval: "one_off" } } as const

// The free credits every organization gets each month. It is in a group of its own, so a paid plan comes on top of it instead of replacing it
export const free = plan({ planId: "free", versionSlug: "v1", active: true, name: "Free", group: "free", autoEnable: true, items: [{ featureId: credits.featureId, included: 25, reset: { interval: "month" } }] })

// The paid plans replace each other: Autumn makes a move to a dearer plan an upgrade (now) and to a cheaper one a downgrade (at the period's end). A yearly plan costs 20% less than twelve months and still gives its credits each month
export const hobbyMonthly = plan({ planId: "hobby_monthly", versionSlug: "v1", active: true, name: "Hobby", group: "paid", price: { amount: 20, interval: "month" }, items: [{ featureId: credits.featureId, included: 100, reset: { interval: "month" } }, topUp] })
export const builderMonthly = plan({ planId: "builder_monthly", versionSlug: "v1", active: true, name: "Builder", group: "paid", price: { amount: 50, interval: "month" }, items: [{ featureId: credits.featureId, included: 250, reset: { interval: "month" } }, topUp] })
export const proMonthly = plan({ planId: "pro_monthly", versionSlug: "v1", active: true, name: "Pro", group: "paid", price: { amount: 100, interval: "month" }, items: [{ featureId: credits.featureId, included: 500, reset: { interval: "month" } }, topUp] })
export const hobbyYearly = plan({ planId: "hobby_yearly", versionSlug: "v1", active: true, name: "Hobby", group: "paid", price: { amount: 192, interval: "year" }, items: [{ featureId: credits.featureId, included: 100, reset: { interval: "month" } }, topUp] })
export const builderYearly = plan({ planId: "builder_yearly", versionSlug: "v1", active: true, name: "Builder", group: "paid", price: { amount: 480, interval: "year" }, items: [{ featureId: credits.featureId, included: 250, reset: { interval: "month" } }, topUp] })
export const proYearly = plan({ planId: "pro_yearly", versionSlug: "v1", active: true, name: "Pro", group: "paid", price: { amount: 960, interval: "year" }, items: [{ featureId: credits.featureId, included: 500, reset: { interval: "month" } }, topUp] })

// A plan we give by hand: no one can buy it or change to it, and its organization has no credit limit
export const unlimited = plan({ planId: "unlimited", versionSlug: "v1", active: true, name: "Unlimited", group: "paid", items: [{ featureId: credits.featureId, unlimited: true }] })

export default atmn({ features: [credits], plans: [free, hobbyMonthly, builderMonthly, proMonthly, hobbyYearly, builderYearly, proYearly, unlimited] })
