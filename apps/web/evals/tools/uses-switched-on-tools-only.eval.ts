import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { called, found, marker } from "@/evals/shared"
import { searchNotes } from "@/usecases/notes"
import { listTools, updateTool } from "@/usecases/tools"

const DRAWING = ["media_image_create", "media_image_edit"]

// The persona has only the tool families its creator left switched on: a switched-off family is out of its tool list and out of its tool search, the background tools included. The families load when a turn starts, so a switch applies from the next message
export default defineEval<typeof config>({
  description: "The persona uses switched-on tool families only, and a switch applies from the next message.",
  tags: ["tools"],
  async test(t) {
    const { caller, personaId, headers } = await t.context.makePersona()
    const title = marker("Locker")

    const noNotes = await updateTool(caller, personaId, "note", { enabled: false })
    if (!noNotes.ok) throw new Error(noNotes.error.message)
    const noDrawing = await updateTool(caller, personaId, "media_images", { enabled: false })
    if (!noDrawing.ok) throw new Error(noDrawing.error.message)

    const first = await t.send(`Save a note titled ${title} that says my gym locker code is 4471. If you have no tool for notes, just tell me, without changing any settings or handing it to anyone else.`, { headers })
    t.check(called(first).some((name) => name.startsWith("note_")), satisfies((value) => value === false, "no tool of the switched-off note family is called"))
    t.check(found(first).some((name) => name.startsWith("note_")), satisfies((value) => value === false, "and the tool search brings none of them back"))

    const second = await first.session.send("Draw me a picture of a red bicycle with your image drawing tool. If you have no such tool, just tell me, without changing any settings or handing it to anyone else.", { headers })
    t.check(called(second).some((name) => DRAWING.includes(name)), satisfies((value) => value === false, "no tool of the switched-off media_images family is called"))

    const listed = await listTools(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)
    const stillOff = !listed.value.note.enabled && !listed.value.media_images.enabled
    t.check(stillOff, satisfies((value) => value === true, "both families are still off before the eval switches anything"))

    const notesOn = await updateTool(caller, personaId, "note", { enabled: true })
    if (!notesOn.ok) throw new Error(notesOn.error.message)

    const third = await first.session.send("Check again: save that note now.", { headers })
    t.check(called(third).includes("note_create"), satisfies((value) => value === true, "switched on, the note family is used on the next message"))

    const saved = await searchNotes(caller, personaId)
    const note = saved.ok ? saved.value.find((item) => item.title === title) : undefined
    t.check(note, satisfies((value) => value !== undefined, "the note was saved"))

    const notesOff = await updateTool(caller, personaId, "note", { enabled: false })
    if (!notesOff.ok) throw new Error(notesOff.error.message)

    const fourth = await first.session.send(`Save another note titled ${title}-2 that says my bike lock code is 9902. If you can no longer save notes, just tell me, without changing any settings or handing it to anyone else.`, { headers })
    t.check(called(fourth).some((name) => name.startsWith("note_")), satisfies((value) => value === false, "switched off, the note family is gone from the next message"))
    t.succeeded()
  },
})
