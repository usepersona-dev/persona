import { defineTool } from "eve/tools"
import { z } from "zod"

import { readCaller } from "@/usecases/agent"
import { listFiles } from "@/usecases/files"

const PAGE_SIZE = 10

export default defineTool({
  description: `List your files, ${PAGE_SIZE} to a page, newest first: the ones the person shared with you and the ones you made, each with its id, name, type and size. To find a file by its name, give words from the name. When pages is more than page, ask for the next page. file_read copies one into your sandbox to work on it.`,
  inputSchema: z.object({
    page: z.number().int().min(1).optional().describe("The page to read. Defaults to 1."),
    query: z.string().trim().max(200).optional().describe("Words from the file's name. Only the files whose names hold them come back."),
  }),
  label: { start: () => "List files" },
  async execute({ page = 1, query = "" }, ctx) {
    const { caller, personaId } = readCaller(ctx)

    const listed = await listFiles(caller, personaId)
    if (!listed.ok) throw new Error(listed.error.message)

    // A page past the end gives the last page
    const words = query.toLowerCase()
    const matching = listed.value.filter((file) => file.name.toLowerCase().includes(words))
    const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
    const current = Math.min(page, pages)
    const shown = matching.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

    const files = shown.map((file) => ({
      id: file.id,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      updatedAt: file.updatedAt
    }))
    
    const result = { page: current, pages, total: matching.length, files }
    return result
  },
})
