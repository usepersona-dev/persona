// An automation's schedule as the form shows it: how often, the time and the days. It becomes a cron or a one-time date, and is read back from one.
// A cron the form can't show, such as one the persona wrote in a chat, stays as written under Custom.

export type Freq = "once" | "hourly" | "daily" | "weekly" | "monthly" | "custom"
export type Plan = { freq: Freq; time: string; days: string[]; dom: number; every: number; at: string; cron: string }

export const FREQS: { value: Freq; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "hourly", label: "Every few hours" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "custom", label: "Custom" },
]

export const HOURS = [1, 2, 3, 4, 6, 8, 12].map((value) => ({ value, label: value === 1 ? "1 hour" : `${value} hours` }))

export const DAYS = [
  { value: "0", letter: "S", short: "Sun", name: "Sunday" },
  { value: "1", letter: "M", short: "Mon", name: "Monday" },
  { value: "2", letter: "T", short: "Tue", name: "Tuesday" },
  { value: "3", letter: "W", short: "Wed", name: "Wednesday" },
  { value: "4", letter: "T", short: "Thu", name: "Thursday" },
  { value: "5", letter: "F", short: "Fri", name: "Friday" },
  { value: "6", letter: "S", short: "Sat", name: "Saturday" },
]

export function planOf(schedule: { cron: string | null; at: string | null }): Plan {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  const plan: Plan = { freq: "daily", time: "09:00", days: ["1"], dom: 1, every: 1, at: localInput(tomorrow), cron: "" }
  if (schedule.at) return { ...plan, freq: "once", at: localInput(new Date(schedule.at)) }
  if (!schedule.cron) return plan

  const cron = schedule.cron.trim()
  const custom: Plan = { ...plan, freq: "custom", cron }
  const [minute, hour, dom, month, dow, ...extra] = cron.split(/\s+/)
  if (extra.length > 0 || month !== "*") return custom

  const every = hour === "*" ? 1 : Number(/^\*\/(\d+)$/.exec(hour)?.[1])
  if (minute === "0" && dom === "*" && dow === "*" && HOURS.some((item) => item.value === every)) return { ...plan, freq: "hourly", every }
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return custom

  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  if (dom === "*" && dow === "*") return { ...plan, freq: "daily", time }
  if (dom === "*" && /^[0-6](-[0-6])?(,[0-6](-[0-6])?)*$/.test(dow)) return { ...plan, freq: "weekly", time, days: daysOf(dow) }
  if (/^\d+$/.test(dom) && dow === "*") return { ...plan, freq: "monthly", time, dom: Number(dom) }
  return custom
}

export function scheduleOf(plan: Plan): { cron: string; at: null } | { cron: null; at: string } {
  if (plan.freq === "once") return { cron: null, at: new Date(plan.at).toISOString() }
  if (plan.freq === "custom") return { cron: plan.cron.trim(), at: null }
  if (plan.freq === "hourly") return { cron: plan.every === 1 ? "0 * * * *" : `0 */${plan.every} * * *`, at: null }

  const [hour, minute] = plan.time.split(":").map(Number)
  if (plan.freq === "daily") return { cron: `${minute} ${hour} * * *`, at: null }
  if (plan.freq === "weekly") return { cron: `${minute} ${hour} * * ${[...plan.days].sort().join(",")}`, at: null }
  return { cron: `${minute} ${hour} ${plan.dom} * *`, at: null }
}

export function describe(plan: Plan): string {
  if (plan.freq === "once") return `Once, ${stamp(new Date(plan.at))}`
  if (plan.freq === "custom") return `Custom schedule: ${plan.cron}`
  if (plan.freq === "hourly") return plan.every === 1 ? "Every hour" : `Every ${plan.every} hours`

  const at = clock(plan.time)
  if (plan.freq === "daily") return `Every day at ${at}`
  if (plan.freq === "monthly") return `The ${ordinal(plan.dom)} of each month at ${at}`

  const days = [...plan.days].sort()
  const key = days.join(",")
  if (days.length === 0) return "Pick at least one day"
  if (key === "1,2,3,4,5") return `Weekdays at ${at}`
  if (key === "0,6") return `Weekends at ${at}`
  if (days.length === 7) return `Every day at ${at}`
  if (days.length === 1) return `${DAYS[Number(days[0])].name}s at ${at}`
  return `${days.map((day) => DAYS[Number(day)].short).join(", ")} at ${at}`
}

export function clock(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  const text = `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`
  return text
}

export function stamp(date: Date) {
  if (Number.isNaN(date.getTime())) return "pick a date"
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function ordinal(day: number) {
  const tail = day % 100 >= 11 && day % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][day % 10] ?? "th")
  return `${day}${tail}`
}

// The days of a cron's day-of-week field, with ranges such as 1-5 spelled out
function daysOf(dow: string) {
  const days = dow.split(",").flatMap((part) => {
    const [from, to = from] = part.split("-").map(Number)
    return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => String(from + index))
  })
  return [...new Set(days)]
}

// A date as a datetime-local input wants it: the local date and time, to the minute
function localInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
