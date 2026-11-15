import useSWR from "swr"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as automations from "@/usecases/automations"

export type Automation = AutomationList[number]
export type AutomationRun = RunList[number]
export type CreateAutomationInput = Parameters<typeof automations.createAutomation>[2]
export type UpdateAutomationInput = Parameters<typeof automations.updateAutomation>[2]
type AutomationList = Output<typeof automations.listAutomations>
type RunList = Output<typeof automations.listRuns>
type AutomationRef = { id: string; personaId: string }

// A ready-made automation: a pick opens New automation filled in, and nothing is saved until Create
export type Suggestion = { id: string; name: string; description: string; cron: string; prompt: string }

export function useAutomations(personaId: string) {
  const { data, error, isLoading } = useSWR<AutomationList, ApiError>(`/api/personas/${personaId}/automations`, fetcher)
  return { automations: data, error, isLoading }
}

// The suggested automations, a static file in public/. The first thirteen are written for any persona; the rest are for one line of work each (sales, finance, engineering and others) and name the apps they use.
export function useAutomationSuggestions() {
  const { data, error, isLoading } = useSWR<Suggestion[], ApiError>("/automation-suggestions.json", fetcher)
  return { suggestions: data, error, isLoading }
}

export function useRuns(automationId: string) {
  const { data, error, isLoading } = useSWR<RunList, ApiError>(`/api/automations/${automationId}/runs`, fetcher)
  return { runs: data, error, isLoading }
}

export function useCreateAutomation(personaId: string) {
  const key = `/api/personas/${personaId}/automations`
  const create = useAction(key, (input: CreateAutomationInput) => request<Automation>("POST", key, input))
  return create
}

export function useUpdateAutomation(automation: AutomationRef) {
  const key = `/api/personas/${automation.personaId}/automations`
  const update = useAction(key, (input: UpdateAutomationInput) => request<Automation>("PATCH", `/api/automations/${automation.id}`, input))
  return update
}

export function useRemoveAutomation(personaId: string) {
  const key = `/api/personas/${personaId}/automations`
  const remove = useAction(key, (automationId: string) => request<void>("DELETE", `/api/automations/${automationId}`))
  return remove
}
