export type Job = {
  path: string
  delaySeconds: number
}

// The queue service (apps/queue) takes the jobs and calls each one's path on this app after its wait, with AUTOMATIONS_SECRET, and again when the call fails
async function send(jobs: Job[]) {
  const url = new URL("/jobs", process.env.QUEUE_URL)
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${process.env.QUEUE_SECRET}` }, body: JSON.stringify(jobs) })
  if (!response.ok) throw new Error(`The queue service answered ${response.status}.`)
}

export const queue = { send }
