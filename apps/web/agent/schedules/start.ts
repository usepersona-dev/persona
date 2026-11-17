import type { BatchSendMessage } from "@vercel/queue"
import { chunk, forEachAsync } from "es-toolkit"
import { defineSchedule } from "eve/schedules"

import { AUTOMATION_RUNS, queue, TRIGGER_RUNS } from "@/lib/queue"
import { claimDueRuns, claimTriggerRuns, failStuckRuns, reclaimLostRuns } from "@/usecases/runs"

const LIMIT = 7000
const BATCH = 100
const PARALLEL = 10

export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) { waitUntil(start(new Date())) },
})

export async function start(now: Date) {
  // Runs going for over an hour are over: they fail, and their chats hear nothing
  await failStuckRuns(now)

  // Claim the runs: one for each automation that is due, one for each trigger whose events have waited five minutes, plus the runs that never got a session; past the limit, the next tick claims the rest
  const due = await claimDueRuns(now, LIMIT)
  const triggered = await claimTriggerRuns(now, LIMIT)
  const lost = await reclaimLostRuns(now, LIMIT)
  const runs = [...due, ...triggered, ...lost]

  // One message for each run, on the queue of its kind: an automation run waits there until its start, a trigger run goes right away
  const automationRuns = runs.filter((run) => run.source === "automation")
  const automationMessages = automationRuns.map((run) => ({ payload: { automationId: run.scheduleId!, runId: run.id }, delaySeconds: secondsUntil(run.claimedAt) }))

  const triggerRuns = runs.filter((run) => run.source === "trigger")
  const triggerMessages = triggerRuns.map((run) => ({ payload: { triggerId: run.triggerId!, runId: run.id } }))

  await sendAll(AUTOMATION_RUNS, automationMessages)
  await sendAll(TRIGGER_RUNS, triggerMessages)
}

// Sends the messages 100 in one request, the most a Vercel Queue takes, a few requests at a time. A run the queue does not take is claimed again five minutes after its start
async function sendAll<T>(topic: string, messages: BatchSendMessage<T>[]) {
  const batches = chunk(messages, BATCH)
  await forEachAsync(batches, async (batch) => {
    try {
      const results = await queue.sendBatch(topic, batch)
      const failed = results.filter((result) => result.status === "failed")
      if (failed.length > 0) console.error(`${failed.length} runs could not be queued on ${topic}; they are sent again five minutes after their start.`, failed[0])
    } catch (error) {
      console.error(`${batch.length} runs could not be queued on ${topic}; they are sent again five minutes after their start.`, error)
    }
  }, { concurrency: PARALLEL })
}

// Whole seconds from now until a run's start; a start that has passed is now
function secondsUntil(time: string) {
  const wait = Date.parse(time) - Date.now()
  const seconds = Math.ceil(wait / 1000)
  return Math.max(0, seconds)
}
