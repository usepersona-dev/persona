import { and, or } from "@prisma/orm-postgres/orm-client"
import { z } from "zod"

import { nextRunAt } from "@/lib/cron"
import { db } from "@/prisma/db"

const EARLY_MS = 10 * 60_000
const WINDOW_MS = 5 * 60_000
const LOST_AFTER_MS = 5 * 60_000
const STUCK_MS = 60 * 60_000

/** What a run's session must come back with, for any kind of run: what came of it, and whether its chat should hear about it. */
export const runResult = z.object({
  summary: z.string().describe("What came of the task: the news or the reminder itself, not a log of your steps."),
  notify: z.boolean().describe("Whether it's worth telling the person now: something new, something changed, or something they need to act on.")
})

/** One new run for each automation due within ten minutes, claimed from the time it starts; the queue holds it until that time. A repeating one starts up to ten minutes early, so the many due at the same time don't all start at once. Two ticks running at once each get their own runs, so nothing runs twice. */
export async function claimDueRuns(now: Date, limit: number) {
  // Get the enabled automations due within ten minutes and not running, oldest first
  const soon = new Date(now.getTime() + EARLY_MS).toISOString()
  const automations = await db.orm.public.Schedule
    .where({ enabled: true })
    .where((schedule) => schedule.nextRunAt.lte(soon))
    .where((schedule) => schedule.runs.none((run) => run.status.eq("running")))
    .orderBy((schedule) => schedule.nextRunAt.asc())
    .limit(limit)
    .all()

  // Make one run per automation for the time it was due, claimed from the time it starts; a run another tick already made is skipped
  const due = automations.map((automation) => ({
    personaId: automation.personaId,
    source: "automation" as const,
    title: automation.name,
    linkId: automation.linkId,
    scheduleId: automation.id,
    scheduledFor: automation.nextRunAt!,
    claimedAt: startsAt(automation)
  }))

  const runs = await db.orm.public.Run.createAll(due, { onConflict: "skip", conflictOn: ["scheduleId", "scheduledFor"] })

  // Move each automation to its next time after the one it was due, or after now when it's late, so an early claim doesn't bring that time back; moves alike go in one update, and one another tick moved already is left alone
  const moves = automations.map((automation) => {
    const due = new Date(automation.nextRunAt!)
    const after = due > now ? due : now
    return { id: automation.id, from: automation.nextRunAt!, to: nextRunAt(automation, after) }
  })

  const groups = Map.groupBy(moves, (move) => `${move.from} ${move.to}`)
  for (const group of groups.values()) {
    const { from, to } = group[0]!
    const ids = group.map((move) => move.id)
    await db.orm.public.Schedule
      .where((schedule) => schedule.id.in(ids))
      .where({ nextRunAt: from })
      .updateAll({ nextRunAt: to })
  }

  return runs
}

/** One new run for each trigger whose first waiting event came five minutes ago, holding all the trigger's waiting events. The run is keyed by that first event, so when two ticks race, the second can't make it again. */
export async function claimTriggerRuns(now: Date, limit: number) {
  // Get the triggers whose oldest waiting event is five minutes old, each with its waiting events, oldest first
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString()
  const triggers = await db.orm.public.Trigger
    .include("events", (events) => events.where((event) => event.runId.isNull()).orderBy((event) => event.createdAt.asc()))
    .where((trigger) => trigger.events.some((event) => and(event.runId.isNull(), event.createdAt.lte(windowStart))))
    .orderBy((trigger) => trigger.createdAt.asc())
    .limit(limit)
    .all()

  // Make one run per trigger with its waiting events, in one transaction so a run never comes without them; a trigger another tick took first is left to it
  const runs = []
  for (const trigger of triggers) {
    const events = trigger.events.map((event) => ({ id: event.id }))

    try {
      const run = await db.transaction((tx) => tx.orm.public.Run.create({
        personaId: trigger.personaId,
        source: "trigger",
        title: trigger.name,
        linkId: trigger.linkId,
        triggerId: trigger.id,
        eventId: events[0]!.id,
        events: (relation) => relation.connect(events)
      }))
      runs.push(run)
    } catch (error) {
      console.warn(`Trigger ${trigger.id} got no run this tick; another tick took it, or the next one tries again.`, error)
    }
  }

  return runs
}

/** The automation and trigger runs that never got a session, claimed again five minutes after their start. Two ticks running at once never get the same run. */
export async function reclaimLostRuns(now: Date, limit: number) {
  // Get the runs that still have no session five minutes after their start (or their last claim), oldest first. A run whose automation or trigger was deleted can never start: it is left out, and fails an hour later like any run that never starts
  const lostBefore = new Date(now.getTime() - LOST_AFTER_MS).toISOString()
  const lost = await db.orm.public.Run
    .where({ status: "running" })
    .where((run) => run.source.in(["automation", "trigger"]))
    .where((run) => run.sessionId.isNull())
    .where((run) => or(run.scheduleId.isNotNull(), run.triggerId.isNotNull()))
    .where((run) => run.claimedAt.lt(lostBefore))
    .orderBy((run) => run.claimedAt.asc())
    .limit(limit)
    .all()

  if (lost.length === 0) return []

  // Claim them again in one update; a run another tick claimed first is left out
  const ids = lost.map((run) => run.id)
  const runs = await db.orm.public.Run
    .where((run) => run.id.in(ids))
    .where((run) => run.claimedAt.lt(lostBefore))
    .updateAll({ claimedAt: now.toISOString() })

  return runs
}

/** Ends a run with what its session came back with, with its chat; an answer that doesn't match the schema ends it as failed, kept here for us, and its chat hears nothing. A run ends once: the same ending arriving again changes nothing and gives back no run. */
export async function completeRun(runId: string, sessionId: string, answer: unknown) {
  const parsed = runResult.safeParse(answer)
  const status = parsed.success ? "completed" : "failed"
  const result = parsed.success ? parsed.data : { summary: "It ended without a result.", notify: false }

  const ended = await db.orm.public.Run
    .include("link")
    .where({ id: runId, status: "running" })
    .updateAll({ status, result, sessionId, endedAt: new Date().toISOString() })
  return ended
}

/** Ends a run that failed, with its chat; the failure is kept here for us, and its chat hears nothing. A run ends once: the same ending arriving again changes nothing and gives back no run. */
export async function failRun(runId: string, sessionId: string, message: string) {
  const ended = await db.orm.public.Run
    .include("link")
    .where({ id: runId, status: "running" })
    .updateAll({ status: "failed", result: { summary: message, notify: false }, sessionId, endedAt: new Date().toISOString() })
  return ended
}

/** Fails the runs that have been going for over an hour since they were last claimed, including a webhook call whose session never started, so they stop blocking their automations; the failure is kept here for us, and their chats hear nothing. */
export async function failStuckRuns(now: Date) {
  const stuckBefore = new Date(now.getTime() - STUCK_MS).toISOString()

  const failed = await db.orm.public.Run
    .include("link")
    .where({ status: "running" })
    .where((run) => run.claimedAt.lt(stuckBefore))
    .updateAll({ status: "failed", result: { summary: "It ran for over an hour without finishing.", notify: false }, endedAt: now.toISOString() })
  return failed
}

// When a due automation starts: a one-time one on its time, a repeating one at a random moment up to ten minutes before it, new for each run
function startsAt(automation: { at: string | null; nextRunAt: string | null }) {
  const oneTime = automation.at === automation.nextRunAt
  if (oneTime) return automation.nextRunAt!

  const offset = Math.floor(Math.random() * EARLY_MS)
  const due = Date.parse(automation.nextRunAt!)
  const start = new Date(due - offset).toISOString()
  return start
}
