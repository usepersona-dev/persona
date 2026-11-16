import { defineSchedule } from "eve/schedules"

import { type Job, queue } from "@/lib/queue"
import { claimDueRuns, claimTriggerRuns, failStuckRuns, reclaimLostRuns } from "@/usecases/runs"

const LIMIT = 7000

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

  // One job for each run: the queue service calls the run's route, an automation run at its start, a trigger run right away
  const jobs: Job[] = []
  for (const run of runs) {
    if (run.source === "automation") jobs.push({ path: `/eve/v1/automations/${run.scheduleId}/${run.id}`, delaySeconds: secondsUntil(run.claimedAt) })
    if (run.source === "trigger") jobs.push({ path: `/eve/v1/triggers/${run.triggerId}/${run.id}`, delaySeconds: 0 })
  }
  if (jobs.length === 0) return

  // The jobs go to the queue service in one request. Runs it never takes are claimed again five minutes after their start
  try {
    await queue.send(jobs)
  } catch (error) {
    console.error(`${jobs.length} runs could not be queued; they are sent again five minutes after their start.`, error)
  }
}

// Whole seconds from now until a run's start; a start that has passed is now
function secondsUntil(time: string) {
  const wait = Date.parse(time) - Date.now()
  const seconds = Math.ceil(wait / 1000)
  return Math.max(0, seconds)
}
