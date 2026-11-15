import useSWR, { mutate } from "swr"
import useSWRImmutable from "swr/immutable"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as personas from "@/usecases/personas"

export type Persona = Output<typeof personas.getPersona>
export type Model = ModelList[number]
export type CreatePersonaInput = Omit<Parameters<typeof personas.createPersona>[1], "projectId">
export type UpdatePersonaInput = Parameters<typeof personas.updatePersona>[2]
export type DuplicatePersonaInput = Parameters<typeof personas.duplicatePersona>[2]
type PersonaList = Output<typeof personas.listPersonas>
type ModelList = Output<typeof personas.listModels>
type PersonaRef = { id: string; projectId: string }

export function usePersonas(projectId: string) {
  const { data, error, isLoading } = useSWR<PersonaList, ApiError>(`/api/projects/${projectId}/personas`, fetcher)
  return { personas: data, error, isLoading }
}

export function usePersona(personaId: string) {
  const { data, error, isLoading } = useSWR<Persona, ApiError>(`/api/personas/${personaId}`, fetcher)
  return { persona: data, error, isLoading }
}

export function useModels() {
  const { data, error, isLoading } = useSWRImmutable<ModelList, ApiError>("/api/models", fetcher)
  return { models: data, error, isLoading }
}

export function useCreatePersona(projectId: string) {
  const key = `/api/projects/${projectId}/personas`
  const create = useAction(key, (input: CreatePersonaInput) => request<Persona>("POST", key, input))
  return create
}

export function useUpdatePersona(persona: PersonaRef) {
  const key = `/api/personas/${persona.id}`
  const update = useAction(key, (input: UpdatePersonaInput) => request<Persona>("PATCH", key, input), { onSuccess: () => mutate(`/api/projects/${persona.projectId}/personas`) })
  return update
}

export function useRemovePersona(projectId: string) {
  const key = `/api/projects/${projectId}/personas`
  const remove = useAction(key, (personaId: string) => request<void>("DELETE", `/api/personas/${personaId}`))
  return remove
}

export function useDuplicatePersona(persona: PersonaRef) {
  const key = `/api/projects/${persona.projectId}/personas`
  const duplicate = useAction(key, (input?: DuplicatePersonaInput) => request<Persona>("POST", `/api/personas/${persona.id}/duplicate`, input))
  return duplicate
}
