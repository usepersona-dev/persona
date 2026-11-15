"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowUpDownIcon, CheckIcon, ChevronRightIcon, CloudOffIcon, EllipsisIcon, RotateCcwIcon, SearchIcon, SearchXIcon, SlidersHorizontalIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Filter } from "@/components/filter"
import { ScreenEmpty, ScreenRow, ScreenRows, ScreenRowSkeleton, ScreenSection, ScreenSectionCount, ScreenSectionTitle } from "@/components/screen"
import { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle } from "@/components/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useUpdatePersona, type Model, type Persona } from "@/hooks/personas"

import { SORTS, useModelList } from "./use-model-list"

const Schema = z.object({
  model: z.string().min(1),
  when: z.string().trim().min(1, "Say when to use it.").max(500, "Keep it under 500 characters."),
})

type Values = z.infer<typeof Schema>

// The models the persona runs on, each with when to use it, and the gateway's other models to add. With two or more, each message runs on the one that fits it. A click on a model opens a dialog to add it, or to change or remove it; Restore brings back the default bundle.
export function ModelsPage({ persona }: { persona: Persona }) {
  const { models, error, isLoading, defaultModel, bundle, selected, providers, matches, shown, hasMore, total, query, setQuery, provider, setProvider, sort, setSort, loadMore, clear } = useModelList(persona)
  const [picked, setPicked] = useState<Model | null>(null)
  const [editing, setEditing] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // The dialog keeps the model it shows while it closes, so it has content while it fades out
  function pick(model: Model) {
    setPicked(model)
    setEditing(true)
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Models</SectionTitle>
        <SectionDescription>
          Pick the models <span className="font-semibold text-foreground">{persona.name}</span> runs on.
        </SectionDescription>
        <SectionAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More" />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem variant="destructive" onClick={() => setRestoring(true)}>
                <RotateCcwIcon />
                Restore
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SectionAction>
      </SectionHeader>
      <InputGroup className="h-11 bg-card">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={total ? `Search ${total}+ models` : "Search models"} aria-label="Search models" />
      </InputGroup>
      {error && (
        <ScreenEmpty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CloudOffIcon />
            </EmptyMedia>
            <EmptyTitle>The models did not load</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </ScreenEmpty>
      )}
      {isLoading && (
        <ScreenSection>
          <ScreenSectionTitle>Selected</ScreenSectionTitle>
          <ScreenRows>
            <ScreenRowSkeleton />
          </ScreenRows>
        </ScreenSection>
      )}
      {bundle.length > 0 && (
        <ScreenSection>
          <ScreenSectionTitle>
            Selected <ScreenSectionCount>{bundle.length}</ScreenSectionCount>
          </ScreenSectionTitle>
          <ScreenRows>
            {bundle.map((item) => (
              <ModelRow key={item.model.id} model={item.model} description={item.when || details(item.model)} selected onPick={pick} />
            ))}
          </ScreenRows>
        </ScreenSection>
      )}
      {bundle.length === 0 && defaultModel && (
        <ScreenSection>
          <ScreenSectionTitle>Selected</ScreenSectionTitle>
          <ScreenRows>
            <ModelRow model={defaultModel} description={details(defaultModel)} selected onPick={pick} />
          </ScreenRows>
        </ScreenSection>
      )}
      {isLoading && (
        <ScreenSection>
          <ScreenSectionTitle>All models</ScreenSectionTitle>
          <ScreenRows>
            {Array.from({ length: 6 }, (_, index) => (
              <ScreenRowSkeleton key={index} />
            ))}
          </ScreenRows>
        </ScreenSection>
      )}
      {models && (
        <ScreenSection>
          <div className="flex items-center gap-1">
            <ScreenSectionTitle className="me-auto">
              All models <ScreenSectionCount>{matches.length}</ScreenSectionCount>
            </ScreenSectionTitle>
            <Filter icon={SlidersHorizontalIcon} label="Provider" value={provider} options={providers} onChange={setProvider} />
            <Filter icon={ArrowUpDownIcon} label="Sort by" value={sort} options={SORTS} onChange={setSort} />
          </div>
          {!!shown.length && (
            <ScreenRows>
              {shown.map((model) => (
                <ModelRow key={model.id} model={model} description={details(model)} selected={selected.has(model.id)} onPick={pick} />
              ))}
            </ScreenRows>
          )}
          {hasMore && (
            <Button variant="outline" className="self-center" onClick={loadMore}>
              Load more
            </Button>
          )}
          {matches.length === 0 && (
            <ScreenEmpty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No models match</EmptyTitle>
                <EmptyDescription>Check the spelling, or pick another provider.</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={clear}>
                Clear filters
              </Button>
            </ScreenEmpty>
          )}
        </ScreenSection>
      )}
      <ModelDialog persona={persona} model={picked} open={editing} onOpenChange={setEditing} />
      <RestoreDialog persona={persona} open={restoring} onOpenChange={setRestoring} />
    </Section>
  )
}

// One model: its name, then when to use it or who makes it, how much it reads at once and its price. A click on the row opens its dialog.
function ModelRow({ model, description, selected, onPick }: { model: Model; description: string; selected: boolean; onPick: (model: Model) => void }) {
  return (
    <ScreenRow className="relative">
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button type="button" onClick={() => onPick(model)} className="text-start outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {model.name}
          </button>
          {model.default && <Badge variant="secondary">Default</Badge>}
        </ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>{selected ? <CheckIcon className="size-4 text-primary" /> : <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100 rtl:rotate-180" />}</ItemActions>
    </ScreenRow>
  )
}

// Adds a model to the ones the persona runs on, with when to use it, or changes when to use one it has, or removes it
function ModelDialog({ persona, model, open, onOpenChange }: { persona: Persona; model: Model | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const update = useUpdatePersona(persona)
  const saved = persona.models.find((item) => item.model === model?.id)
  const form = useForm<Values>({ resolver: zodResolver(Schema), values: { model: model?.id ?? "", when: saved?.when ?? "" } })
  const busy = update.isMutating

  // The form holds one option of the bundle: the model, which has no field so it can't change, and when to use it
  async function save(option: Values) {
    if (!model) return
    const models = saved ? persona.models.map((item) => (item.model === option.model ? option : item)) : [...persona.models, option]
    const updated = await update.trigger({ models })
    if (!updated) return

    toast.add({ title: saved ? `Saved ${model.name}` : `Added ${model.name}`, type: "success" })
    onOpenChange(false)
  }

  async function remove() {
    if (!model) return
    const models = persona.models.filter((item) => item.model !== model.id)
    const updated = await update.trigger({ models })
    if (!updated) return

    toast.add({ title: `Removed ${model.name}`, type: "success" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={(stillOpen) => !stillOpen && form.reset()}>
      <DialogContent>
        {model && (
          <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(save)}>
            <DialogHeader>
              <DialogTitle>{saved ? model.name : `Add ${model.name}`}</DialogTitle>
              <DialogDescription>{saved ? "Change when to use it, or remove it." : "Say when to use it. With two or more models, each message runs on the one that fits it."}</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Controller
                control={form.control}
                name="when"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="model-when">When to use it</FieldLabel>
                    <Textarea {...field} id="model-when" aria-invalid={fieldState.invalid} placeholder="Hard tasks that need many steps" />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>
            <DialogFooter>
              {saved && (
                <Button type="button" variant="destructive" className="sm:me-auto" disabled={busy} onClick={remove}>
                  Remove
                </Button>
              )}
              <DialogClose render={<Button variant="outline" />} disabled={busy}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={busy}>
                {busy && <Spinner data-icon="inline-start" />}
                {saved ? (busy ? "Saving…" : "Save") : busy ? "Adding…" : "Add model"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Asks before the persona goes back to the default model alone, with just a title, a line and the buttons
function RestoreDialog({ persona, open, onOpenChange }: { persona: Persona; open: boolean; onOpenChange: (open: boolean) => void }) {
  const update = useUpdatePersona(persona)

  async function confirm() {
    const updated = await update.trigger({ models: null })
    if (!updated) return

    toast.add({ title: "Restored the default models", type: "success" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore the default models?</DialogTitle>
          <DialogDescription>Hard tasks run on Gemini 4 Argon again, and quick ones on Gemini 3.8 Flash.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={update.isMutating}>
            Cancel
          </DialogClose>
          <Button variant="destructive" disabled={update.isMutating} onClick={confirm}>
            {update.isMutating && <Spinner data-icon="inline-start" />}
            {update.isMutating ? "Restoring…" : "Restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// openai · 400K context · $1.25 / $10 per 1M tokens, or free
function details(model: Model) {
  const parts = [model.provider]
  if (model.context) parts.push(`${context(model.context)} context`)
  const cost = price(model)
  if (cost) parts.push(cost)
  const text = parts.join(" · ")
  return text
}

// 400K, 1M
function context(tokens: number) {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M`
  return `${Math.round(tokens / 1000)}K`
}

// $1.25 / $10 per 1M tokens, free, or nothing when the gateway gives only half of it
function price(model: Model) {
  if (model.tags.includes("free")) return "free"
  if (model.input === null || model.output === null) return null
  return `$${model.input} / $${model.output} per 1M tokens`
}
