import { publicHandler, readJson } from "@/app/api/handler"
import { openCollectLink, submitCollectLink } from "@/usecases/vault"

type Params = { token: string }

export const GET = publicHandler<Params>(async ({ token }) => {
  const link = await openCollectLink(token)
  return link
})

export const POST = publicHandler<Params>(async ({ token }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const values = await submitCollectLink(token, input.value)
  return values
})
