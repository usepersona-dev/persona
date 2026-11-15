import { handler } from "@/app/api/handler"
import { listApps } from "@/usecases/integrations"

export const GET = handler(async () => {
  const apps = await listApps()
  return apps
})
