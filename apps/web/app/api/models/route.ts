import { handler } from "@/app/api/handler"
import { listModels } from "@/usecases/personas"

export const GET = handler(async () => {
  const models = await listModels()
  return models
})
