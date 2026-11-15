"use client"

import { CheckIcon, EyeIcon, EyeOffIcon, LinkIcon, LockIcon } from "lucide-react"
import { useState } from "react"
import { Controller } from "react-hook-form"

import { AuthDescription, AuthFooter, AuthFooterButton, AuthHeader, AuthTitle } from "@/app/(auth)/_components/auth-layout"
import { PersonaAvatar } from "@/components/persona-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useCollectForm, type CollectForm } from "@/hooks/vault"
import { cn } from "@/lib/utils"

import { useCollectValues } from "../_hooks/use-collect-values"

// Fills one credential of a persona's vault from a short-lived link (/collect/<token>), with no sign-in: the link's short code names the credential and works for a day.
export function Collect({ token }: { token: string }) {
  const { form: ask, error, isLoading } = useCollectForm(token)
  const [saved, setSaved] = useState(false)

  if (isLoading) return <CollectLoading />
  if (error) return <CollectFailed code={error.code} />
  if (!ask) return null
  if (saved) return <CollectSaved onChange={() => setSaved(false)} />

  return <CollectFields token={token} ask={ask} onSaved={() => setSaved(true)} />
}

// A field that already has a value says so, and leaving it empty keeps that value
function CollectFields({ token, ask, onSaved }: { token: string; ask: CollectForm; onSaved: () => void }) {
  const { form, save, saving, typed } = useCollectValues(token, ask, onSaved)

  return (
    <CollectScreen>
      <CollectHeader ask={ask} />
      <form className="flex flex-col gap-5" onSubmit={save}>
        <FieldGroup className="gap-4">
          {ask.fields.map((item, index) => (
            <Controller
              key={item.name}
              control={form.control}
              name={`values.${index}`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor={`collect-${index}`}>{item.name}</FieldLabel>
                    {item.filled && (
                      <Badge variant="secondary">
                        <CheckIcon data-icon="inline-start" />
                        Saved
                      </Badge>
                    )}
                  </div>
                  {item.secret ? <SecretInput {...field} id={`collect-${index}`} aria-invalid={fieldState.invalid} placeholder={item.filled ? "Type to replace it" : undefined} /> : <Input {...field} id={`collect-${index}`} aria-invalid={fieldState.invalid} autoComplete="off" placeholder={item.filled ? "Type to replace it" : undefined} />}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ))}
        </FieldGroup>
        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={!typed || saving}>
            {saving && <Spinner data-icon="inline-start" />}
            {saving ? "Saving…" : "Save to the vault"}
          </Button>
          <AuthFooter className="text-xs text-pretty text-muted-foreground/70">
            <LockIcon className="me-1 inline size-3 align-[-1px]" />
            Encrypted. Only this persona can use it.
          </AuthFooter>
        </div>
      </form>
    </CollectScreen>
  )
}

// No card: one quiet step on the page itself, with room between the ask and the form
function CollectScreen({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="collect-screen" className={cn("flex flex-col gap-8", className)} {...props} />
}

function CollectHeader({ ask }: { ask: CollectForm }) {
  return (
    <AuthHeader>
      <PersonaAvatar name={ask.persona.name} imageUrl={ask.persona.imageUrl} className="mb-3 size-16 rounded-2xl" />
      <p className="text-sm font-medium text-muted-foreground">{ask.persona.name} asks for</p>
      <AuthTitle>{ask.title}</AuthTitle>
      {ask.description && <AuthDescription>{ask.description}</AuthDescription>}
    </AuthHeader>
  )
}

// A secret stays dots until the eye shows it
function SecretInput(props: React.ComponentProps<typeof InputGroupInput>) {
  const [shown, setShown] = useState(false)

  return (
    <InputGroup>
      <InputGroupInput {...props} type={shown ? "text" : "password"} autoComplete="off" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label={shown ? "Hide" : "Show"} onClick={() => setShown(!shown)}>
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

function CollectSaved({ onChange }: { onChange: () => void }) {
  return (
    <CollectScreen>
      <AuthHeader>
        <span className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-success/10 text-success">
          <CheckIcon className="size-7" />
        </span>
        <AuthTitle>Saved</AuthTitle>
        <AuthDescription>It is in the vault now. You can close this page.</AuthDescription>
      </AuthHeader>
      <AuthFooter>
        Typed something wrong? <AuthFooterButton onClick={onChange}>Change it</AuthFooterButton>
      </AuthFooter>
    </CollectScreen>
  )
}

// The token decides the message: an expired link says so, a broken one asks for a new link, and anything else asks for a reload
function CollectFailed({ code }: { code: string }) {
  const expired = code === "invalid"
  const broken = code === "not_found"
  const title = expired ? "This link has expired" : broken ? "This link does not work" : "Something went wrong"
  const description = expired ? "A link works for one day. Ask for a new one in the chat." : broken ? "Check that you have the whole link, or ask for a new one in the chat." : "Reload the page to try again."

  return (
    <CollectScreen>
      <AuthHeader>
        <span className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <LinkIcon className="size-6" />
        </span>
        <AuthTitle>{title}</AuthTitle>
        <AuthDescription>{description}</AuthDescription>
      </AuthHeader>
    </CollectScreen>
  )
}

function CollectLoading() {
  return (
    <CollectScreen aria-busy="true">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="mb-3 size-16 rounded-2xl" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-10 w-full" />
    </CollectScreen>
  )
}
