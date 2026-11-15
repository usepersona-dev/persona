"use client"

import { ArrowUpIcon, FileIcon, PlusIcon, SquarePenIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react"

import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { FileDetail } from "@/hooks/files"

type Picked = { id: string; file: File; saved?: FileDetail; failed?: boolean }

// The chat's field, shadcn's input group in our shape: the reply and the picked files on top, attach and New chat at the bottom left, Send at the right.
// A file uploads the moment it is picked, dropped or pasted, its chip spins until it is up, and Send waits for every chip. A reply shows the message it answers, faded, until it is sent or taken off
export function ChatComposer({ replying, onCancelReply, onSend, onUpload, onDiscard, onNewChat }: { replying?: string; onCancelReply: () => void; onSend: (text: string, files: FileDetail[]) => void; onUpload: (file: File) => Promise<FileDetail | undefined>; onDiscard: (fileId: string) => Promise<unknown>; onNewChat: () => void }) {
  const [text, setText] = useState("")
  const [picked, setPicked] = useState<Picked[]>([])
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const removed = useRef(new Set<string>())
  const draft = text.trim()
  const filled = draft.length > 0 || picked.length > 0
  const pending = picked.some((item) => !item.saved)
  const ready = filled && !pending

  useEffect(() => {
    if (replying) field.current?.focus()
  }, [replying])

  function submit() {
    if (!ready) return
    const files = picked.flatMap((item) => (item.saved ? [item.saved] : []))
    onSend(draft, files)
    setText("")
    setPicked([])
  }

  function add(list: FileList | null) {
    if (!list || list.length === 0) return
    const added = Array.from(list, (file) => ({ id: crypto.randomUUID(), file }))
    setPicked((current) => [...current, ...added])
    for (const item of added) void upload(item)
  }

  // A chip taken off while its file was still uploading deletes the file once it lands
  async function upload(item: Picked) {
    const saved = await onUpload(item.file)
    if (saved && removed.current.has(item.id)) {
      void onDiscard(saved.id)
      return
    }
    setPicked((current) => current.map((other) => (other.id === item.id ? { ...other, saved, failed: !saved } : other)))
  }

  function takeOff(item: Picked) {
    removed.current.add(item.id)
    setPicked((current) => current.filter((other) => other.id !== item.id))
    if (item.saved) void onDiscard(item.saved.id)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (event.clipboardData.files.length === 0) return
    event.preventDefault()
    add(event.clipboardData.files)
  }

  function onDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    setDragging(false)
    add(event.dataTransfer.files)
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <InputGroup data-dragging={dragging} className="gap-2 rounded-[1.625rem]! border-foreground/10 bg-card p-2.5 shadow-[0_0.125rem_0.75rem_rgb(0_0_0/0.07)] has-[[data-slot=input-group-control]:focus-visible]:border-foreground/25 has-[[data-slot=input-group-control]:focus-visible]:ring-0 data-[dragging=true]:border-dashed data-[dragging=true]:border-ring data-[dragging=true]:bg-[color-mix(in_oklab,var(--accent)_50%,var(--background))]">
        {(replying || picked.length > 0) && (
          <InputGroupAddon align="block-start" className="flex-col items-stretch p-0 font-normal text-foreground">
            {replying && (
              <div className="flex items-center gap-1 ps-1">
                <p className="min-w-0 flex-1 truncate rounded-2xl bg-accent px-[11px] py-[5px] text-[11px] leading-[1.45] opacity-55">{replying}</p>
                <IconButton label="Cancel reply" onClick={onCancelReply}>
                  <XIcon />
                </IconButton>
              </div>
            )}
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((item) => (
                  <PickedFile key={item.id} item={item} onRemove={() => takeOff(item)} />
                ))}
              </div>
            )}
          </InputGroupAddon>
        )}
        <InputGroupTextarea ref={field} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} rows={1} placeholder="Ask anything" aria-label="Message input" enterKeyHint="send" className="max-h-32 min-h-9 px-2.5 py-1 caret-primary placeholder:text-muted-foreground/60 md:text-xs" />
        <InputGroupAddon align="block-end" className="p-0">
          <IconButton label="Add photos and files" onClick={() => picker.current?.click()}>
            <PlusIcon />
          </IconButton>
          <IconButton label="New chat" onClick={onNewChat}>
            <SquarePenIcon />
          </IconButton>
          <InputGroupButton type="submit" variant="default" size="icon-sm" aria-label="Send message" disabled={!ready} className="ms-auto size-7 rounded-full">
            <ArrowUpIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          add(event.target.files)
          event.target.value = ""
        }}
      />
    </form>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<InputGroupButton size="icon-sm" aria-label={label} onClick={onClick} className="size-7 rounded-full text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground" />}>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

// A picked file: a spinner while it uploads, then the picture from its link in Files, or the file's icon. A failed upload says so, and its chip comes off to send
function PickedFile({ item, onRemove }: { item: Picked; onRemove: () => void }) {
  const state = item.failed ? "error" : item.saved ? "done" : "uploading"
  const picture = item.saved?.contentType.startsWith("image/") ? item.saved.url : null

  return (
    <Attachment size="sm" state={state} className="min-w-0 bg-background">
      <AttachmentMedia variant={picture ? "image" : "icon"}>{state === "uploading" ? <Spinner /> : picture ? <img src={picture} alt="" /> : <FileIcon />}</AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{item.file.name}</AttachmentTitle>
        {state === "error" && <AttachmentDescription>Did not upload. Take it off and try again.</AttachmentDescription>}
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label={`Remove ${item.file.name}`} onClick={onRemove}>
          <XIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}
