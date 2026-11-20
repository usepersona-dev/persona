import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { called, found, marker } from "@/evals/shared"
import { searchNotes } from "@/usecases/notes"
import { updateTool } from "@/usecases/tools"

const DRAWING = ["media_image_create", "media_image_edit"]
const SEARCH = "Run your tool search three times, with the queries \"note\", \"media\" and \"file\", and tell me the tool names each one brings back. Run all three now, don't answer from memory."

// A deferred family stays out of the persona's tool list: the persona finds its tools with its tool search and still uses them. What the search brings back is the check here: the tools of the deferred families, and never those of a switched-off family or of a family that is in the list. Deferral loads when a turn starts, so a change applies from the next message
export default defineEval<typeof config>({
  description: "The persona finds deferred tool families through its tool search, and a change applies from the next message.",
  tags: ["tools"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const title = marker("Locker")

    const notes = await updateTool(caller, personaId, "note", { deferred: true })
    if (!notes.ok) throw new Error(notes.error.message)
    const audio = await updateTool(caller, personaId, "media_audio", { deferred: true })
    if (!audio.ok) throw new Error(audio.error.message)
    const drawing = await updateTool(caller, personaId, "media_images", { enabled: false, deferred: true })
    if (!drawing.ok) throw new Error(drawing.error.message)

    const first = await t.send(`Save a note titled ${title} that says my gym locker code is 4471.`, { headers })
    t.check(found(first).includes("note_create"), satisfies((value) => value === true, "note_create, of the deferred note family, is found through the tool search"))
    t.check(called(first).includes("note_create"), satisfies((value) => value === true, "and it is still used"))

    const saved = await searchNotes(caller, personaId)
    const note = saved.ok ? saved.value.find((item) => item.title === title) : undefined
    t.check(note, satisfies((value) => value !== undefined, "the note was saved"))

    const second = await first.session.send(SEARCH, { headers })
    t.log(`search before the change: ${found(second).join(", ")}`)
    t.check(found(second).includes("note_search"), satisfies((value) => value === true, "a deferred family's tools are in the search"))
    t.check(found(second).includes("media_transcribe"), satisfies((value) => value === true, "the deferred media_audio family is in the search"))
    t.check(found(second).some((name) => DRAWING.includes(name)), satisfies((value) => value === false, "the switched-off media_images family is not, even when it is deferred"))
    t.check(found(second).includes("media_read"), satisfies((value) => value === false, "media_read, a family of its own that is in the list, is not"))
    t.check(found(second).some((name) => name.startsWith("file_")), satisfies((value) => value === false, "and neither is the file family, also in the list"))

    const listed = await updateTool(caller, personaId, "note", { deferred: false })
    if (!listed.ok) throw new Error(listed.error.message)
    const hidden = await updateTool(caller, personaId, "file", { deferred: true })
    if (!hidden.ok) throw new Error(hidden.error.message)

    const third = await first.session.send(SEARCH, { headers })
    t.log(`search after the change: ${found(third).join(", ")}`)
    t.check(found(third).includes("file_list"), satisfies((value) => value === true, "deferred mid-chat, the file family is in the search from the next message"))
    t.check(found(third).some((name) => name.startsWith("note_")), satisfies((value) => value === false, "back in the list, the note family is out of the search"))

    const fourth = await first.session.send(`Save another note titled ${title}-2 that says my bike lock code is 9902.`, { headers })
    t.check(called(fourth).includes("note_create"), satisfies((value) => value === true, "and it is still used"))
    t.succeeded()
  },
})
