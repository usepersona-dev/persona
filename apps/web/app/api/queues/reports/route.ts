import { queue, type Report } from "@/lib/queue"

// The queue hands each run worth telling here as soon as it ends, and this calls the report route of the run's own channel, which tells its chat. A run that's gone is dropped; any other failure comes back from the queue
export const POST = queue.handleCallback<Report>(async ({ path }) => {
  const url = new URL(path, process.env.APP_URL)
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.AUTOMATIONS_SECRET}` } })
  if (response.status === 404) return
  if (!response.ok) throw new Error(`The report route answered ${response.status}.`)
})
