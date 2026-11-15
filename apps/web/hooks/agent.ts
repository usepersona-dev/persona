import { useAction } from "@/hooks/use-action"
import { request } from "@/lib/api-client"
import type { Output } from "@/lib/errors"
import type * as agent from "@/usecases/agent"

export type AgentToken = Output<typeof agent.createAgentToken>

export function useGetAgentToken(personaId: string) {
  const key = `/api/personas/${personaId}/agent-token`
  const getAgentToken = useAction(key, () => request<AgentToken>("POST", key))
  return getAgentToken
}
