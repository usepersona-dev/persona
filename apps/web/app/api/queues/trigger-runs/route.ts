import { queue, type TriggerRun } from "@/lib/queue"

// The queue hands each trigger run here, and this calls the run route, which starts the run's session with the trigger's events. A run that's gone is dropped; any other failure comes back from the queue
export const POST = queue.handleCallback<TriggerRun>(async ({ triggerId, runId }) => {
  const url = new URL(`/eve/v1/triggers/${triggerId}/${runId}`, process.env.APP_URL)
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  if (response.status === 404) return
  if (!response.ok) throw new Error(`The run route answered ${response.status}.`)
})
