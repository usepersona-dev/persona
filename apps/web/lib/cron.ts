import { Cron } from "croner"

export function isValidCron(expression: string): boolean {
  try {
    const parsed = new Cron(expression, { paused: true })
    return parsed.nextRun() !== null
  } catch {
    return false
  }
}

export function nextRunAt(when: { cron: string | null; at: string | null; timezone: string }, after: Date) {
  let next: Date | null = null

  if (when.at) {
    const at = new Date(when.at)
    if (at > after) next = at
  }

  if (when.cron) {
    const repeat = new Cron(when.cron, { timezone: when.timezone }).nextRun(after)
    if (repeat && (!next || repeat < next)) next = repeat
  }

  return next ? next.toISOString() : null
}
