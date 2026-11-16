import { z } from "zod"

// The queue service: the app hands it calls to make later, and it makes each one at its time, and again when the call fails. Node runs it with BullMQ (server.ts), next to the Redis that keeps the calls.
//   GET /health    200 while the service runs
//   POST /jobs     the app's jobs, with QUEUE_SECRET: a list of { path, delaySeconds }, each a path on the app and the seconds to wait first
//   anything else  404
// A call is a POST to the job's path on the app, with AUTOMATIONS_SECRET, the secret the app's run and report routes take

export type Env = {
  APP_URL: string
  AUTOMATIONS_SECRET: string
  QUEUE_SECRET: string
}

export type Job = {
  path: string
  delaySeconds: number
}

const jobsInput = z.array(z.object({ path: z.string(), delaySeconds: z.number().min(0).default(0) }))

// The door: takes the app's jobs and hands them to add, which keeps each one until its time
export async function receive(request: Request, env: Env, add: (jobs: Job[]) => Promise<void>): Promise<Response> {
  const url = new URL(request.url)
  const route = `${request.method} ${url.pathname}`
  if (route === "GET /health") return new Response("ok")
  if (route !== "POST /jobs") return new Response("Not found.", { status: 404 })

  const authorization = request.headers.get("authorization")
  if (authorization !== `Bearer ${env.QUEUE_SECRET}`) return new Response("Not allowed.", { status: 401 })

  const body = await readJson(request)
  const parsed = jobsInput.safeParse(body)
  if (!parsed.success) return new Response("Send a list of jobs: each with a path on the app, and the seconds to wait.", { status: 400 })

  await add(parsed.data)
  return new Response(null, { status: 202 })
}

// The call. A path that is gone (404) is dropped; any other failure throws, so the queue makes the call again. The answer is read and dropped, so Node can use its connection again
export async function deliver(job: Job, env: Env): Promise<void> {
  const url = new URL(job.path, env.APP_URL)
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${env.AUTOMATIONS_SECRET}` } })
  await response.arrayBuffer()

  if (response.status === 404) return
  if (!response.ok) throw new Error(`The app answered ${response.status}.`)
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const body = await request.json()
    return body
  } catch {
    return null
  }
}
