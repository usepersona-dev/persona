import useSWR, { mutate } from "swr"
import useSWRImmutable from "swr/immutable"

import { useAction } from "@/hooks/use-action"
import { fetcher, request, type ApiError } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as skills from "@/usecases/skills"

export type SkillSummary = SkillList[number]
export type Skill = Output<typeof skills.getSkill>
export type MarketplaceSkill = MarketplaceList[number]
export type MarketplaceSkillPreview = Output<typeof skills.previewMarketplaceSkill>
export type AddSkillInput = Parameters<typeof skills.addSkill>[2]
export type UpdateSkillInput = Parameters<typeof skills.updateSkill>[2]
type SkillList = Output<typeof skills.listSkills>
type MarketplaceList = Output<typeof skills.searchSkillMarketplace>
type SkillRef = { id: string; personaId: string }

export function useSkills(personaId: string) {
  const { data, error, isLoading } = useSWR<SkillList, ApiError>(`/api/personas/${personaId}/skills`, fetcher)
  return { skills: data, error, isLoading }
}

export function useSkill(skillId: string) {
  const { data, error, isLoading } = useSWR<Skill, ApiError>(`/api/skills/${skillId}`, fetcher)
  return { skill: data, error, isLoading }
}

export function useMarketplaceSkills(query: string) {
  const { data, error, isLoading } = useSWRImmutable<MarketplaceList, ApiError>(`/api/marketplace/skills?query=${encodeURIComponent(query)}`, fetcher)
  return { skills: data, error, isLoading }
}

export function useMarketplaceSkill(marketplaceId: string) {
  const path = marketplaceId.split("/").map(encodeURIComponent).join("/")
  const { data, error, isLoading } = useSWRImmutable<MarketplaceSkillPreview, ApiError>(`/api/marketplace/skills/${path}`, fetcher)
  return { skill: data, error, isLoading }
}

export function useAddSkill(personaId: string) {
  const key = `/api/personas/${personaId}/skills`
  const add = useAction(key, (input: AddSkillInput) => request<Skill>("POST", key, input))
  return add
}

export function useInstallMarketplaceSkill(personaId: string) {
  const key = `/api/personas/${personaId}/skills`
  const install = useAction(key, (marketplaceId: string) => request<Skill>("POST", `${key}/install`, { marketplaceId }))
  return install
}

// The list is the key, so a switch can turn a skill on or off in place; the full skill reloads after
export function useUpdateSkill(skill: SkillRef) {
  const key = `/api/personas/${skill.personaId}/skills`
  const update = useAction(key, (input: UpdateSkillInput) => request<Skill>("PATCH", `/api/skills/${skill.id}`, input), { onSuccess: () => mutate(`/api/skills/${skill.id}`) })
  return update
}

export function useRemoveSkill(personaId: string) {
  const key = `/api/personas/${personaId}/skills`
  const remove = useAction(key, (skillId: string) => request<void>("DELETE", `/api/skills/${skillId}`))
  return remove
}
