import { cn } from "@/lib/utils"

import type { Plan } from "./schedule"

// The sky's top and bottom colors through the day, from night through dawn, noon and dusk. A tile blends the two stops around its hour.
const SKY: [number, string, string][] = [
  [0, "#0b1430", "#1d2c55"],
  [4.5, "#1b2550", "#4a3f6b"],
  [6, "#6f7fb8", "#f2a585"],
  [7, "#8fb3dd", "#fcd3a8"],
  [8.5, "#6fa9de", "#cfe6f5"],
  [10.5, "#4b93d6", "#a8d4f3"],
  [13, "#3a86d0", "#8ec7f0"],
  [15.5, "#5b95cf", "#e7d2a4"],
  [17.5, "#7a5aa6", "#f0956a"],
  [19, "#4a3a7e", "#c56f6b"],
  [20.5, "#1f2554", "#4a3a7e"],
  [24, "#0b1430", "#1d2c55"],
]

function mix(from: string, to: string, share: number) {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16)
  const parts = [1, 3, 5].map((at) => Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * share))
  return `rgb(${parts.join(" ")})`
}

function skyAt(hour: number) {
  const next = SKY.findIndex(([at]) => at > hour)
  const [fromAt, fromTop, fromBottom] = SKY[next - 1]
  const [toAt, toTop, toBottom] = SKY[next]
  const share = (hour - fromAt) / (toAt - fromAt)
  return `linear-gradient(180deg, ${mix(fromTop, toTop, share)} 0%, ${mix(fromBottom, toBottom, share)} 100%)`
}

// The run time without AM or PM, since the sky shows which. Every few hours shows 6h, and a custom schedule cron.
function clock(plan: Plan) {
  if (plan.freq === "hourly") return { hour: 12, text: `${plan.every}h` }
  if (plan.freq === "custom") return { hour: 12, text: "cron" }

  const [hours, minutes] = (plan.freq === "once" ? plan.at.slice(11, 16) : plan.time).split(":").map(Number)
  return { hour: hours + minutes / 60, text: `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}` }
}

// The sky at the run time, with the sun or the moon where it would be, and the time in white
export function TimeTile({ plan, className }: { plan: Plan; className?: string }) {
  const { hour, text } = clock(plan)
  const sun = hour >= 5.5 && hour < 20
  const lift = sun ? Math.max(0.12, Math.sin((Math.PI * (hour - 6)) / 12)) : Math.max(0.25, Math.sin((Math.PI * ((hour - 18 + 24) % 24)) / 12))
  const across = sun ? Math.min(1, Math.max(0, (hour - 5) / 15)) : ((hour - 20 + 24) % 24) / 9
  const spot = { left: 5 + across * 25, top: 20 - lift * 15 }

  return (
    <span aria-hidden className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-xl", className)} style={{ background: skyAt(hour) }}>
      {sun ? <span className="absolute size-2.5 rounded-full bg-[#fff1b8] shadow-[0_0_6px_2px_rgb(255_236_170/0.7)]" style={spot} /> : <span className="absolute size-2.5 rounded-full shadow-[inset_-2.5px_-1px_0_0_#f4efdc]" style={spot} />}
      <span className="absolute inset-x-0 bottom-1 text-center text-[9.5px] leading-none font-bold text-white tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">{text}</span>
    </span>
  )
}
