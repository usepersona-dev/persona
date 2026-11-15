import { handler, readJson } from "@/app/api/handler"
import { inviteMember } from "@/usecases/organizations"

export const POST = handler(async (caller, params, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const invitation = await inviteMember(caller, input.value)
  return invitation
})
