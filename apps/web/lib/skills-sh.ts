import { getVercelOidcToken } from "@vercel/oidc"

export type HubSkill = {
  id: string
  slug: string
  name: string
  source: string
  installs: number
  sourceType: "github" | "well-known"
  installUrl: string | null
  url: string
  isDuplicate?: boolean
}

export type HubSkillFiles = {
  id: string
  source: string
  slug: string
  installs: number
  hash: string | null
  files: { path: string; contents: string }[] | null
}

const API = "https://skills.sh/api/v1/skills"

async function get<T>(path: string): Promise<T> {
  const token = await getVercelOidcToken()
  const response = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`skills.sh answered ${response.status}`)
  return await response.json()
}

async function search(query: string): Promise<HubSkill[]> {
  const q = query.trim()
  const { data } = q.length < 2 ? await get<{ data: HubSkill[] }>("?per_page=50") : await get<{ data: HubSkill[] }>(`/search?q=${encodeURIComponent(q)}&limit=50`)
  return data
}

async function read(id: string): Promise<HubSkillFiles> {
  return await get<HubSkillFiles>(`/${id}`)
}

export const skillsSh = { search, read }
