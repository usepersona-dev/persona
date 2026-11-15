"use client"

import { CalendarCheckIcon, CalendarDaysIcon, CalendarIcon, ClockIcon, CodeIcon, GlobeIcon, RepeatIcon, SendIcon, TimerIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { Choose, Edit, Property } from "@/components/property"
import { Section } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Automation, Suggestion } from "@/hooks/automations"
import type { Persona } from "@/hooks/personas"

import { clock, DAYS, FREQS, HOURS, stamp, type Plan } from "./schedule"
import { useAutomationForm } from "./use-automation-form"

export function AutomationPanel({ persona, automation, suggestion, open, onOpenChange }: { persona: Persona; automation: Automation | null; suggestion: Suggestion | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <AutomationForm persona={persona} automation={automation} suggestion={suggestion} onClose={() => onOpenChange(false)} />
    </SidePanel>
  )
}

// Inside the panel, so the form starts fresh each time the panel opens
function AutomationForm({ persona, automation, suggestion, onClose }: { persona: Persona; automation: Automation | null; suggestion: Suggestion | null; onClose: () => void }) {
  const { form, submit, saving, deleting, confirming, setConfirming, deleteAutomation, chats, timezone } = useAutomationForm(persona, automation, suggestion, onClose)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">{automation?.name ?? "New automation"}</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <input {...field} aria-label="Name" aria-invalid={fieldState.invalid} placeholder="Untitled automation" autoComplete="off" className="w-full bg-transparent font-heading text-4xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex flex-col gap-1">
              <Controller control={form.control} name="plan" render={({ field, fieldState }) => <ScheduleProperties plan={field.value} onChange={field.onChange} error={fieldState.error?.message} />} />
              <Controller
                control={form.control}
                name="linkId"
                render={({ field }) => (
                  <Property icon={SendIcon} label="Send to">
                    <Choose items={chats} value={field.value} onChange={field.onChange} />
                  </Property>
                )}
              />
              <Property icon={GlobeIcon} label="Timezone">
                <span className="px-3 text-sm">{timezone}</span>
              </Property>
            </div>
            <Controller
              control={form.control}
              name="prompt"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="automation-prompt">What to do</FieldLabel>
                  <Textarea {...field} id="automation-prompt" aria-invalid={fieldState.invalid} placeholder="Describe the whole task, step by step." className="max-h-[50dvh] min-h-56 rounded-[10px] bg-card px-4 leading-7 md:text-base" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex justify-end gap-2">
              {automation && (
                <Button type="button" variant="destructive" className="me-auto" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {automation ? (saving ? "Saving…" : "Save") : saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Section>
      </SidePanelBody>
      {automation && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{automation.name}”?</AlertDialogTitle>
              <AlertDialogDescription>This automation stops for good. To stop it for a while, pause it instead.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteAutomation}>
                {deleting && <Spinner data-icon="inline-start" />}
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

// How often, then only the properties that frequency needs. Its one error sits under them.
function ScheduleProperties({ plan, onChange, error }: { plan: Plan; onChange: (plan: Plan) => void; error?: string }) {
  const timed = plan.freq === "daily" || plan.freq === "weekly" || plan.freq === "monthly"
  const dayNames = [...plan.days].sort().map((day) => DAYS[Number(day)].short).join(", ")

  function set(patch: Partial<Plan>) {
    onChange({ ...plan, ...patch })
  }

  return (
    <>
      <Property icon={RepeatIcon} label="Repeats">
        <Choose items={FREQS} value={plan.freq} onChange={(freq) => set({ freq })} />
      </Property>
      {plan.freq === "weekly" && (
        <Property icon={CalendarDaysIcon} label="Days">
          <Edit value={dayNames || "Pick days"} invalid={!!error}>
            <ToggleGroup multiple variant="outline" spacing={1} value={plan.days} onValueChange={(days) => set({ days })} aria-label="Days">
              {DAYS.map((day) => (
                <ToggleGroupItem key={day.value} value={day.value} aria-label={day.name} className="w-9">
                  {day.letter}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Edit>
        </Property>
      )}
      {plan.freq === "monthly" && (
        <Property icon={CalendarIcon} label="Day">
          <Edit value={`Day ${plan.dom}`}>
            <Input type="number" min={1} max={31} value={plan.dom} onChange={(event) => set({ dom: Math.min(31, Math.max(1, Number(event.target.value) || 1)) })} aria-label="Day of the month" className="w-24" />
          </Edit>
        </Property>
      )}
      {timed && (
        <Property icon={ClockIcon} label="Time">
          <Edit value={clock(plan.time)}>
            <Input type="time" value={plan.time} onChange={(event) => set({ time: event.target.value })} aria-label="Time" />
          </Edit>
        </Property>
      )}
      {plan.freq === "hourly" && (
        <Property icon={TimerIcon} label="Every">
          <Choose items={HOURS} value={plan.every} onChange={(every) => set({ every })} />
        </Property>
      )}
      {plan.freq === "once" && (
        <Property icon={CalendarCheckIcon} label="Date">
          <Edit value={stamp(new Date(plan.at))} invalid={!!error}>
            <Input type="datetime-local" value={plan.at} aria-invalid={!!error} onChange={(event) => set({ at: event.target.value })} aria-label="Date and time" />
          </Edit>
        </Property>
      )}
      {plan.freq === "custom" && (
        <Property icon={CodeIcon} label="Cron">
          <Edit value={plan.cron || "Write a cron"} invalid={!!error}>
            <Input value={plan.cron} aria-invalid={!!error} onChange={(event) => set({ cron: event.target.value })} placeholder="0 9 * * 1" aria-label="Cron" className="font-mono" />
            <FieldDescription>Minute, hour, day of the month, month and day of the week.</FieldDescription>
          </Edit>
        </Property>
      )}
      {error && <FieldError className="ps-36">{error}</FieldError>}
    </>
  )
}
