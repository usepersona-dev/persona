import { serve } from "@hono/node-server"
import { Queue, Worker } from "bullmq"

import { deliver, receive, type Env, type Job } from "./queue.ts"

// The queue service with Node and BullMQ, for Docker Compose and any server of your own. Each setting is required
const env: Env = { APP_URL: setting("APP_URL"), AUTOMATIONS_SECRET: setting("AUTOMATIONS_SECRET"), QUEUE_SECRET: setting("QUEUE_SECRET") }
const redis = setting("REDIS_URL")

// Redis keeps each job until its time. A call that fails is made again after 5, 10, 20 and 40 seconds: 5 tries in all. A job that is done leaves Redis, and the last 1,000 that failed stay to look at
// With Redis down a new job fails at once, so the app hears it, instead of waiting for Redis to come back
const jobs = new Queue<Job>("jobs", {
  connection: {
    url: redis,
    enableOfflineQueue: false
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 1000
  }
})

jobs.on("error", (error) => console.error(error))

const worker = new Worker<Job>("jobs", (job) => deliver(job.data, env), { connection: { url: redis }, concurrency: 50 })
worker.on("error", (error) => console.error(error))
worker.on("failed", (job, error) => {
  if (!job) return
  console.error(`Try ${job.attemptsMade} of the call to ${job.data.path} failed: ${error.message}`)
})

const server = serve({ fetch: (request) => receive(request, env, add), port: 3003 })
console.log("The queue service is listening on port 3003.")

process.on("SIGTERM", stop)
process.on("SIGINT", stop)

async function add(list: Job[]) {
  const calls = list.map((job) => ({ name: "call", data: job, opts: { delay: job.delaySeconds * 1000 } }))
  await jobs.addBulk(calls)
}

// A stop lets the calls in progress finish. The jobs still waiting stay in Redis for the next start
async function stop() {
  server.close()
  await worker.close()
  await jobs.close()
  process.exit(0)
}

function setting(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set.`)
  return value
}
