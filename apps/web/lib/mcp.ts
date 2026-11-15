import { createMCPClient } from "@ai-sdk/mcp"

export type McpProbe = { ok: true; server: { name: string; version: string }; tools: { name: string; description: string }[] } | { ok: false; reason: "unauthorized" | "not-mcp" | "unreachable"; message: string }

type McpFailure = Extract<McpProbe, { ok: false }>

const TIMEOUT = 10_000

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No answer within 10 seconds")), TIMEOUT)
    work.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

async function connect(transport: "http" | "sse", url: string, headers: Record<string, string>): Promise<McpProbe> {
  const client = await withTimeout(createMCPClient({ transport: { type: transport, url, headers }, initializationOptions: { timeout: TIMEOUT } }))
  try {
    const tools: { name: string; description: string }[] = []
    let cursor: string | undefined
    do {
      const page = await withTimeout(client.listTools({ params: { cursor }, options: { timeout: TIMEOUT } }))
      tools.push(...page.tools.map((tool) => ({ name: tool.name, description: tool.description ?? "" })))
      cursor = page.nextCursor
    } while (cursor)

    return { ok: true, server: { name: client.serverInfo.name, version: client.serverInfo.version }, tools }
  } finally {
    await client.close()
  }
}

function classify(error: unknown): McpFailure {
  const message = error instanceof Error ? error.message : String(error)
  const status = Number(/\(HTTP (\d{3})\)/.exec(message)?.[1] ?? 0)
  if (status === 401 || status === 403) return { ok: false, reason: "unauthorized", message: "The server wants a token or a sign-in." }
  if (status) return { ok: false, reason: "not-mcp", message: `The server answered ${status} instead of speaking MCP.` }
  return { ok: false, reason: "unreachable", message: "The server did not answer." }
}

async function speaksSse(url: string, headers: Record<string, string>): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { ...headers, accept: "text/event-stream" }, signal: AbortSignal.timeout(5_000) })
    await response.body?.cancel()
    return response.ok && (response.headers.get("content-type") ?? "").includes("text/event-stream")
  } catch {
    return false
  }
}

async function probe(url: string, headers: Record<string, string> = {}): Promise<McpProbe> {
  try {
    return await connect("http", url, headers)
  } catch (error) {
    const failure = classify(error)
    if (failure.reason === "unauthorized" || !(await speaksSse(url, headers))) return failure
    try {
      return await connect("sse", url, headers)
    } catch {
      return failure
    }
  }
}

export const mcp = { probe }
