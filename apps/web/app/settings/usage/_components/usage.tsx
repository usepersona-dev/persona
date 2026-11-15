"use client"

import { CalendarDaysIcon, CloudOffIcon, UserRoundXIcon, UsersRoundIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { Area, AreaChart, XAxis } from "recharts"

import { PersonaAvatar } from "@/components/persona-avatar"
import { ScreenActions, ScreenDescription, ScreenEmpty, ScreenHeader, ScreenTitle } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useProjects } from "@/hooks/projects"
import { useUsage, type Usage as OrgUsage, type UsageSpan } from "@/hooks/usage"
import { cn } from "@/lib/utils"

type Unit = "hour" | "day"
type Period = { value: string; label: string; hours: number; days: number; months: number; unit: Unit }
type Totals = { credits: number; charges: number; tokens: number }
type Bucket = OrgUsage["buckets"][number]
type Series = { key: string; label: string; color: string; days: number[] }

const PERIODS: Period[] = [
  { value: "24h", label: "Last 24 hours", hours: 24, days: 0, months: 0, unit: "hour" },
  { value: "7d", label: "Last 7 days", hours: 0, days: 7, months: 0, unit: "day" },
  { value: "30d", label: "Last 30 days", hours: 0, days: 30, months: 0, unit: "day" },
  { value: "90d", label: "Last 90 days", hours: 0, days: 90, months: 0, unit: "day" },
  { value: "12m", label: "Last 12 months", hours: 0, days: 0, months: 12, unit: "day" },
]
const TOP = 5
// The app's chart colors in the one order that keeps neighbors apart for color-blind eyes: clay, blue, green, violet, ochre
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)"]
const OTHERS = "color-mix(in oklab, var(--muted-foreground) 50%, var(--card))"
const SPARK_BARS = 31
const NO_USAGE: Totals = { credits: 0, charges: 0, tokens: 0 }

// The organization's usage on a page wider than the other settings: the range's credits as one number and as soft layers per project, then a table of the top 5 personas, the other personas in one row, and the removed personas (rows whose persona is no longer in the list).
// Past the top 5, projects and personas fold into a gray "others". Hours and days are the viewer's own, the same the API groups by. Credits are counted live as each model call ends
export function Usage() {
  const [period, setPeriod] = useState(PERIODS[2])
  const span = useMemo(() => spanOf(period), [period])

  function choosePeriod(value: string) {
    const chosen = PERIODS.find((option) => option.value === value)
    if (!chosen) return

    setPeriod(chosen)
  }

  return (
    <div data-wide className="contents">
      <ScreenHeader>
        <ScreenTitle>Usage</ScreenTitle>
        <ScreenDescription>Credits your personas used, updated as they work.</ScreenDescription>
        <ScreenActions>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <CalendarDaysIcon data-icon="inline-start" />
              {period.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuRadioGroup value={period.value} onValueChange={choosePeriod}>
                {PERIODS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ScreenActions>
      </ScreenHeader>
      <UsageBody span={span} />
    </div>
  )
}

function UsageBody({ span }: { span: UsageSpan }) {
  const { usage, error } = useUsage(span)
  const { projects, error: projectsError } = useProjects()

  if (error) return <Failed message={error.message} />
  if (projectsError) return <Failed message={projectsError.message} />
  if (!usage) return <Loading />
  if (!projects) return <Loading />
  return <Report usage={usage} projects={projects} span={span} />
}

function Report({ usage, projects, span }: { usage: OrgUsage; projects: { id: string; name: string }[]; span: UsageSpan }) {
  const starts = startsOf(span)
  const names = new Map(projects.map((project) => [project.id, project.name]))
  const personaIds = new Set(usage.personas.map((persona) => persona.id))
  const total = usage.buckets.reduce(add, NO_USAGE)

  const ranked = usage.personas
    .map((persona) => {
      const buckets = usage.buckets.filter((bucket) => bucket.personaId === persona.id)
      return { ...persona, buckets, used: buckets.reduce(add, NO_USAGE) }
    })
    .sort((first, second) => second.used.credits - first.used.credits)
  const top = ranked.slice(0, TOP).map((persona) => ({ ...persona, days: fold(daysOf(persona.buckets, starts)) }))
  const rest = ranked.slice(TOP)
  const removed = usage.buckets.filter((bucket) => !personaIds.has(bucket.personaId))
  const removedDays = fold(daysOf(removed, starts))
  const peak = Math.max(0, ...top.flatMap((persona) => persona.days), ...removedDays)

  const projectIds = [...new Set(usage.buckets.map((bucket) => bucket.projectId))]
  const projectsUsed = projectIds.map((projectId) => {
    const buckets = usage.buckets.filter((bucket) => bucket.projectId === projectId)
    return { projectId, buckets, credits: buckets.reduce(add, NO_USAGE).credits }
  })
  const byCredits = projectsUsed.sort((first, second) => second.credits - first.credits)
  const colored = byCredits.filter((project) => project.credits > 0 && names.has(project.projectId)).slice(0, TOP)
  const folded = byCredits.filter((project) => !colored.includes(project))

  const series: Series[] = colored.map((project, index) => ({ key: `p${index}`, label: nameOf(names, project.projectId), color: COLORS[index], days: daysOf(project.buckets, starts) }))
  if (folded.length > 0) series.push({ key: "others", label: plural(folded.length, "other project", "other projects"), color: OTHERS, days: daysOf(folded.flatMap((project) => project.buckets), starts) })
  if (series.length === 0) series.push({ key: "none", label: "No usage", color: OTHERS, days: starts.map(() => 0) })
  const rows = starts.map((start, index) => ({ label: labelOf(start, span.unit), ...Object.fromEntries(series.map((one) => [one.key, one.days[index]])) }))

  return (
    <>
      <Card>
        <CardHeader>
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-4xl font-medium tracking-tight">{credits(total.credits)}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </p>
          <CardDescription className="tabular-nums">
            {count(total.charges)} charges · {count(total.tokens)} tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <UsageChart rows={rows} series={series} />
          <Legend series={series} />
        </CardContent>
      </Card>
      <UsageTable total={total} unit={span.unit}>
        {top.map((persona) => (
          <UsageRow key={persona.id} face={<PersonaAvatar name={persona.name} imageUrl={persona.imageUrl} className="size-7 rounded-md" />} title={persona.name} project={nameOf(names, persona.projectId)} days={persona.days} peak={peak} used={persona.used} total={total} color={colorOf(colored, persona.projectId)} />
        ))}
        {rest.length > 0 && <UsageRow face={<OthersFace />} title={plural(rest.length, "other persona", "other personas")} project="" days={[]} peak={peak} used={rest.map((persona) => persona.used).reduce(add, NO_USAGE)} total={total} color={OTHERS} muted />}
        {removed.length > 0 && <UsageRow face={<RemovedFace />} title="Removed personas" project="" days={removedDays} peak={peak} used={removed.reduce(add, NO_USAGE)} total={total} color={OTHERS} muted />}
      </UsageTable>
    </>
  )
}

function UsageChart({ rows, series }: { rows: Record<string, string | number>[]; series: Series[] }) {
  const config: ChartConfig = {}
  series.forEach((one) => {
    config[one.key] = { label: one.label, color: one.color }
  })
  const labels = new Map(series.map((one) => [one.key, one.label]))

  // recharts' monotone curve never swings past a day's value
  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full">
      <AreaChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} accessibilityLayer>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} interval="preserveStartEnd" />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={
            <ChartTooltipContent
              indicator="line"
              className="min-w-40"
              formatter={(value, name, item) => (
                <div className="flex w-full items-center gap-2">
                  <span className="h-2.5 w-1 shrink-0 rounded-[2px]" style={{ background: item.color }} />
                  <span className="text-muted-foreground">{labels.get(String(name))}</span>
                  <span className="ms-auto font-mono font-medium text-foreground tabular-nums">{Number(value).toFixed(2)}</span>
                </div>
              )}
            />
          }
        />
        {series.map((one) => (
          <Area key={one.key} dataKey={one.key} type="monotone" stackId="usage" stroke={`var(--color-${one.key})`} strokeWidth={2} fill={`var(--color-${one.key})`} fillOpacity={0.35} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {series.map((one) => (
        <li key={one.key} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: one.color }} />
          {one.label}
        </li>
      ))}
    </ul>
  )
}

function UsageTable({ total, unit, children }: { total: Totals; unit: Unit; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-5">Persona</TableHead>
            <TableHead className="hidden md:table-cell">Project</TableHead>
            <TableHead className="hidden lg:table-cell">{unit === "hour" ? "By hour" : "By day"}</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Charges</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Tokens</TableHead>
            <TableHead className="text-right max-sm:pe-5">Credits</TableHead>
            <TableHead className="hidden w-40 pe-5 sm:table-cell">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell className="ps-5 font-medium">Total</TableCell>
            <TableCell className="hidden md:table-cell" />
            <TableCell className="hidden lg:table-cell" />
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{count(total.charges)}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{count(total.tokens)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums max-sm:pe-5">{credits(total.credits)}</TableCell>
            <TableCell className="hidden pe-5 sm:table-cell" />
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  )
}

function UsageRow({ face, title, project, days, peak, used, total, color, muted = false }: { face: React.ReactNode; title: string; project: string; days: number[]; peak: number; used: Totals; total: Totals; color: string; muted?: boolean }) {
  return (
    <TableRow>
      <TableCell className="ps-5">
        <span className="flex items-center gap-2.5">
          {face}
          <span className="flex min-w-0 flex-col">
            <span className={cn("font-medium", muted && "text-muted-foreground")}>{title}</span>
            {project && <span className="text-xs text-muted-foreground md:hidden">{project}</span>}
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{project}</TableCell>
      <TableCell className="hidden lg:table-cell">
        <Spark values={days} peak={peak} color={color} />
      </TableCell>
      <TableCell className="hidden text-right tabular-nums sm:table-cell">{count(used.charges)}</TableCell>
      <TableCell className="hidden text-right tabular-nums sm:table-cell">{count(used.tokens)}</TableCell>
      <TableCell className="text-right font-medium tabular-nums max-sm:pe-5">
        {credits(used.credits)}
        <span className="block text-xs font-normal text-muted-foreground sm:hidden">{percent(used.credits, total.credits)}</span>
      </TableCell>
      <TableCell className="hidden pe-5 sm:table-cell">
        <span className="flex items-center gap-2.5">
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${shareOf(used.credits, total.credits)}%`, background: color }} />
          </span>
          <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{percent(used.credits, total.credits)}</span>
        </span>
      </TableCell>
    </TableRow>
  )
}

function Spark({ values, peak, color }: { values: number[]; peak: number; color: string }) {
  return (
    <span className="flex h-6 w-32 items-end gap-[2px]" aria-hidden>
      {values.map((value, index) => (
        <span key={index} className={cn("flex-1 rounded-t-[2px]", value === 0 && "bg-muted")} style={{ height: value === 0 ? "2px" : `${Math.max((value / peak) * 100, 6)}%`, background: value === 0 ? undefined : color }} />
      ))}
    </span>
  )
}

function OthersFace() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <UsersRoundIcon className="size-3.5" />
    </span>
  )
}

function RemovedFace() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground">
      <UserRoundXIcon className="size-3.5" />
    </span>
  )
}

function Loading() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-4 w-56 rounded-sm" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card className="gap-4">
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-3.5 w-32 rounded-sm" />
              <Skeleton className="ms-auto h-3.5 w-16 rounded-sm" />
            </span>
          ))}
        </CardContent>
      </Card>
    </>
  )
}

function Failed({ message }: { message: string }) {
  return (
    <ScreenEmpty role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <CloudOffIcon />
        </EmptyMedia>
        <EmptyTitle>Usage did not load</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </ScreenEmpty>
  )
}

function add(sum: Totals, more: Totals): Totals {
  const added = { credits: sum.credits + more.credits, charges: sum.charges + more.charges, tokens: sum.tokens + more.tokens }
  return added
}

function sumOf(values: number[]) {
  const sum = values.reduce((all, value) => all + value, 0)
  return sum
}

function daysOf(buckets: Bucket[], starts: Date[]) {
  const position = new Map(starts.map((start, index) => [start.getTime(), index]))
  const days = starts.map(() => 0)
  buckets.forEach((bucket) => {
    const index = position.get(new Date(bucket.start).getTime())
    if (index !== undefined) days[index] += bucket.credits
  })
  return days
}

function fold(values: number[]) {
  const size = Math.ceil(values.length / SPARK_BARS)
  if (size <= 1) return values

  const bars = Array.from({ length: Math.ceil(values.length / size) }, (_, index) => sumOf(values.slice(index * size, (index + 1) * size)))
  return bars
}

function nameOf(names: Map<string, string>, projectId: string) {
  const name = names.get(projectId)
  if (!name) return ""
  return name
}

function colorOf(colored: { projectId: string }[], projectId: string) {
  const index = colored.findIndex((project) => project.projectId === projectId)
  if (index === -1) return OTHERS
  return COLORS[index]
}

function plural(amount: number, one: string, many: string) {
  if (amount === 1) return `1 ${one}`
  return `${amount} ${many}`
}

function credits(value: number) {
  const number = value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return number
}

function count(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`
  if (value >= 10_000) return `${(value / 1_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`
  return value.toLocaleString("en-US")
}

function shareOf(part: number, whole: number) {
  if (whole === 0) return 0
  return (part / whole) * 100
}

function percent(part: number, whole: number) {
  const share = shareOf(part, whole)
  if (share > 0 && share < 1) return "<1%"
  return `${Math.round(share)}%`
}

function labelOf(start: Date, unit: Unit) {
  if (unit === "hour") return start.toLocaleTimeString("en-US", { hour: "numeric" })
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// From the start of the range's first hour or day to the end of the current one, in the viewer's time zone
function spanOf(period: Period): UsageSpan {
  const to = nextOf(startOf(new Date(), period.unit), period.unit)
  const back = new Date(to)
  back.setHours(back.getHours() - period.hours)
  back.setDate(back.getDate() - period.days)
  back.setMonth(back.getMonth() - period.months)

  const from = startOf(back, period.unit)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const span = { from: from.toISOString(), to: to.toISOString(), unit: period.unit, timeZone }
  return span
}

function startsOf(span: UsageSpan) {
  const end = new Date(span.to)
  const starts: Date[] = []
  for (let start = new Date(span.from); start < end; start = nextOf(start, span.unit)) starts.push(start)
  return starts
}

function startOf(time: Date, unit: Unit) {
  const start = new Date(time)
  start.setMinutes(0, 0, 0)
  if (unit === "day") start.setHours(0)
  return start
}

function nextOf(start: Date, unit: Unit) {
  const next = new Date(start)
  if (unit === "hour") next.setHours(next.getHours() + 1)
  if (unit === "day") next.setDate(next.getDate() + 1)
  return next
}
