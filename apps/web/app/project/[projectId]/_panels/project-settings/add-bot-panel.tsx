"use client"

import { Controller } from "react-hook-form"

import { Section, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { SidePanel, SidePanelActions, SidePanelBody, SidePanelClose, SidePanelHeader, SidePanelTitle } from "@/components/side-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { Project } from "@/hooks/projects"

import { useAddBotForm } from "./use-add-bot-form"

export function AddBotPanel({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <AddBotForm projectId={project.id} onClose={() => onOpenChange(false)} />
    </SidePanel>
  )
}

// Inside the panel, so the form starts fresh each time the panel opens. BotFather's three steps, then the token.
function AddBotForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { form, adding, submit } = useAddBotForm(projectId, onClose)

  return (
    <>
      <SidePanelHeader floating>
        <SidePanelTitle className="sr-only">Add a Telegram bot</SidePanelTitle>
        <SidePanelActions>
          <SidePanelClose />
        </SidePanelActions>
      </SidePanelHeader>
      <SidePanelBody className="pt-14">
        <Section>
          <SectionHeader>
            <SectionTitle>Add a Telegram bot</SectionTitle>
            <SectionDescription>A bot of your own, for every persona in this project.</SectionDescription>
          </SectionHeader>
          <Steps
            steps={[
              <>
                In Telegram, open <span className="font-semibold">@BotFather</span> and send <span className="font-mono">/newbot</span>.
              </>,
              "Give the bot a name and a username.",
              "Copy the token BotFather sends, and paste it here.",
            ]}
          />
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Controller
              control={form.control}
              name="token"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-token">Bot token</FieldLabel>
                  <Input {...field} id="bot-token" aria-invalid={fieldState.invalid} placeholder="123456789:AAH…" autoComplete="off" spellCheck={false} className="font-mono" />
                  {!fieldState.invalid && <FieldDescription>Persona keeps it safe and does not show it again.</FieldDescription>}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={adding}>
                {adding && <Spinner data-icon="inline-start" />}
                {adding ? "Adding…" : "Add bot"}
              </Button>
            </div>
          </form>
        </Section>
      </SidePanelBody>
    </>
  )
}

// Numbered steps, a number in a soft circle before each
function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{index + 1}</span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  )
}
