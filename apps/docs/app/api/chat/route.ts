import { convertToModelMessages, gateway, stepCountIs, streamText, tool, type UIMessage } from "ai"
import { Document, type DocumentData } from "flexsearch"
import { z } from "zod"

import { source } from "@/lib/source"

type Page = DocumentData & { url: string; title: string; description: string; content: string }

export type ChatUIMessage = UIMessage<never, { client: { location: string } }>

const MODEL = "deepseek/deepseek-v4-flash"

const INSTRUCTIONS = [
  "You answer questions about Persona from its documentation.",
  "Search the docs with the search tool before you answer.",
  "Base the answer on what the search returns, and cite each page you use as a markdown link to its url.",
  "When the docs do not answer the question, say so and suggest a better search.",
].join("\n")

const searchTool = tool({
  description: "Search the Persona docs and return the matching pages as JSON.",
  inputSchema: z.object({ query: z.string(), limit: z.number().int().min(1).max(100).default(10) }),
  async execute({ query, limit }) {
    const index = await indexPages()
    const results = await index.searchAsync(query, { limit, merge: true, enrich: true })
    return results
  },
})

export type SearchTool = typeof searchTool

export async function POST(request: Request) {
  const body = await request.json()
  const messages = await convertToModelMessages<ChatUIMessage>(body.messages ?? [], {
    convertDataPart(part) {
      if (part.type === "data-client") return { type: "text", text: `[Client Context: ${JSON.stringify(part.data)}]` }
    },
  })

  const result = streamText({ model: gateway(MODEL), instructions: INSTRUCTIONS, messages, tools: { search: searchTool }, toolChoice: "auto", stopWhen: stepCountIs(5) })
  return result.toUIMessageStreamResponse()
}

// The docs are a handful of pages, so each search indexes them again instead of keeping an index in the module
async function indexPages() {
  const index = new Document<Page>({ document: { id: "url", index: ["title", "description", "content"], store: true } })
  const pages = await Promise.all(source.getPages().map(async (page) => ({ url: page.url, title: page.data.title, description: page.data.description ?? "", content: await page.data.getText("processed") })))
  for (const page of pages) index.add(page)
  return index
}
