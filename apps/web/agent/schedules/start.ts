import { forEachAsync } from "es-toolkit"
import { defineSchedule } from "eve/schedules"

import { AUTOMATION_RUNS, queue, TRIGGER_RUNS } from "@/lib/queue"
import { claimDueRuns, claimTriggerRuns, failStuckRuns, reclaimLostRuns } from "@/usecases/runs"

const LIMIT = 7000
const PARALLEL = 50

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

  // Put each run in its queue, which hands it to its run route: an automation run at its start, a trigger run right away. A run the queue never takes is claimed again five minutes after its start
  await forEachAsync(runs, async (run) => {
    try {
      if (run.source === "automation") await queue.send(AUTOMATION_RUNS, { automationId: run.scheduleId!, runId: run.id }, { delaySeconds: secondsUntil(run.claimedAt) })
      if (run.source === "trigger") await queue.send(TRIGGER_RUNS, { triggerId: run.triggerId!, runId: run.id })
    } catch (error) {
      console.error(`Run ${run.id} could not be queued; it is sent again five minutes after its start.`, error)
    }
  }, { concurrency: PARALLEL })
}

// Whole seconds from now until a run's start; a start that has passed is now
function secondsUntil(time: string) {
  const wait = Date.parse(time) - Date.now()
  const seconds = Math.ceil(wait / 1000)
  return Math.max(0, seconds)
}
