import { type AutomationRun, queue } from "@/lib/queue"

// The queue hands each automation run here at the run's start, and this calls the run route, which starts the run's session. A run that's gone is dropped; any other failure comes back from the queue
export const POST = queue.handleCallback<AutomationRun>(async ({ automationId, runId }) => {
  const url = new URL(`/eve/v1/automations/${automationId}/${runId}`, process.env.APP_URL)
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  if (response.status === 404) return
  if (!response.ok) throw new Error(`The run route answered ${response.status}.`)
})
