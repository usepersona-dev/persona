import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"

import { deliver, receive, type Env, type Job } from "./queue.ts"

// The queue service's rules, with the app and the queue faked: fetch answers for the app, and add notes the jobs it gets
const env: Env = {
  APP_URL: "https://app.test",
  AUTOMATIONS_SECRET: "app-secret",
  QUEUE_SECRET: "queue-secret"
}

const answers: Record<string, number> = {
  "/eve/v1/automations/a1/r1": 200,
  "/eve/v1/automations/a1/gone": 404,
  "/eve/v1/automations/a1/broken": 500
}

let added: Job[] = []
let called: { method?: string; url: string; authorization: string | null }[] = []

globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(String(input))
  const headers = new Headers(init.headers)
  called.push({ method: init.method, url: url.href, authorization: headers.get("authorization") })
  return new Response(null, { status: answers[url.pathname] })
}

beforeEach(() => {
  added = []
  called = []
})

async function add(jobs: Job[]) {
  added.push(...jobs)
}

function send(body: string, authorization = "Bearer queue-secret"): Promise<Response> {
  const request = new Request("https://queue.test/jobs", { method: "POST", headers: { authorization }, body })
  return receive(request, env, add)
}

test("the door takes the app's jobs, each with its wait, or none", async () => {
  const jobs = [{ path: "/eve/v1/automations/a1/r1", delaySeconds: 90 }, { path: "/eve/v1/triggers/t1/r2" }]
  const taken = await send(JSON.stringify(jobs))

  assert.equal(taken.status, 202)
  assert.deepEqual(added, [
    { path: "/eve/v1/automations/a1/r1", delaySeconds: 90 },
    { path: "/eve/v1/triggers/t1/r2", delaySeconds: 0 }
  ])
})

test("only the secret opens the door", async () => {
  const jobs = JSON.stringify([{ path: "/eve/v1/automations/a1/r1" }])
  const wrong = await send(jobs, "Bearer wrong")
  const none = await send(jobs, "")

  assert.equal(wrong.status, 401)
  assert.equal(none.status, 401)
  assert.deepEqual(added, [])
})

test("only /health and /jobs are there", async () => {
  const health = await receive(new Request("https://queue.test/health"), env, add)
  const read = await receive(new Request("https://queue.test/jobs"), env, add)
  const other = await receive(new Request("https://queue.test/other", { method: "POST" }), env, add)

  assert.equal(health.status, 200)
  assert.equal(read.status, 404)
  assert.equal(other.status, 404)
})

test("a body that is not a list of jobs is refused", async () => {
  const refused = [
    "not json",
    JSON.stringify("jobs"),
    JSON.stringify({ path: "/eve/v1/automations/a1/r1" }),
    JSON.stringify([{}]),
    JSON.stringify([{ path: 5 }]),
    JSON.stringify([{ path: "/eve/v1/automations/a1/r1", delaySeconds: -1 }]),
    JSON.stringify([{ path: "/eve/v1/automations/a1/r1", delaySeconds: "90" }])
  ]

  for (const body of refused) {
    const answer = await send(body)
    assert.equal(answer.status, 400, body)
  }
  assert.deepEqual(added, [])
})

test("a call is a POST to the job's path on the app, with the app's secret", async () => {
  await deliver({ path: "/eve/v1/automations/a1/r1", delaySeconds: 0 }, env)

  assert.deepEqual(called, [{ method: "POST", url: "https://app.test/eve/v1/automations/a1/r1", authorization: "Bearer app-secret" }])
})

test("a path that is gone is dropped, and any other failure throws for another try", async () => {
  await deliver({ path: "/eve/v1/automations/a1/gone", delaySeconds: 0 }, env)

  const broken = deliver({ path: "/eve/v1/automations/a1/broken", delaySeconds: 0 }, env)
  await assert.rejects(broken, /The app answered 500/)
})
