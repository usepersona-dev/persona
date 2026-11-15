import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as billing from "@/usecases/billing"

export type Billing = Output<typeof billing.getBilling>
export type PlanInput = Parameters<typeof billing.changePlan>[1]
export type BuyInput = Parameters<typeof billing.buyCredits>[1]
export type AutoReloadInput = Parameters<typeof billing.updateAutoReload>[1]
type PortalLink = Output<typeof billing.createPortalLink>
type ChangedPlan = Output<typeof billing.changePlan>
type KeptPlan = Output<typeof billing.cancelDowngrade>
type BoughtCredits = Output<typeof billing.buyCredits>
type SavedAutoReload = Output<typeof billing.updateAutoReload>

export function useBilling() {
  const { data, error, isLoading } = useSWR<Billing, ApiError>("/api/billing", fetcher)
  return { billing: data, error, isLoading }
}

export function useUpdateAutoReload() {
  const update = useAction("/api/billing", (input: AutoReloadInput) => request<SavedAutoReload>("PATCH", "/api/billing", input))
  return update
}

export function useChangePlan() {
  const change = useAction("/api/billing", (input: PlanInput) => request<ChangedPlan>("POST", "/api/billing/change-plan", input))
  return change
}

export function useCancelDowngrade() {
  const cancel = useAction("/api/billing", () => request<KeptPlan>("POST", "/api/billing/cancel-downgrade"))
  return cancel
}

export function useBuyCredits() {
  const buy = useAction("/api/billing", (input: BuyInput) => request<BoughtCredits>("POST", "/api/billing/buy-credits", input))
  return buy
}

export function useCreatePortalLink() {
  const key = "/api/billing/portal-link"
  const create = useAction(key, () => request<PortalLink>("POST", key))
  return create
}
