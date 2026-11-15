import { BrowserUse, BrowserUseError, type RunCreateBody } from "browser-use-sdk/v4"

export type { ProxyCountryCode, RunStatus } from "browser-use-sdk/v4"

const ERRORS: Record<number, string> = { 402: "The browser account is out of credit.", 409: "This browser is busy with another task.", 429: "Every browser is busy right now. Try again in a few minutes." }

export async function createRun(input: RunCreateBody) {
  const run = await call((client) => client.runs.create(input))
  return run
}

export async function getRun(runId: string) {
  const run = await call((client) => client.runs.get(runId))
  return run
}

export async function getRunStatus(runId: string) {
  const { status } = await call((client) => client.runs.status(runId))
  return status
}

export async function cancelRun(runId: string) {
  await call((client) => client.runs.cancel(runId))
}

export async function getSession(sessionId: string) {
  const session = await call((client) => client.sessions.get(sessionId))
  return session
}

export async function listActiveBrowsers(sessionId: string) {
  const { items } = await call((client) => client.browsers.list({ agentSessionId: sessionId, filterBy: "active" }))
  return items
}

export async function stopBrowser(browserId: string) {
  await call((client) => client.browsers.stop(browserId))
}

export async function findProfile(userId: string) {
  const { items } = await call((client) => client.profiles.list({ query: userId }))
  const profile = items.find((item) => item.userId === userId)
  return profile
}

export async function createProfile(input: { name: string; userId: string }) {
  const profile = await call((client) => client.profiles.create(input))
  return profile
}

export async function deleteProfile(profileId: string) {
  await call((client) => client.profiles.delete(profileId))
}

// The client reads its key when it is built, so it is built per call: a build has no key
async function call<T>(request: (client: BrowserUse) => Promise<T>) {
  try {
    const answer = await request(new BrowserUse())
    return answer
  } catch (error) {
    if (!(error instanceof BrowserUseError)) throw error
    throw new Error(ERRORS[error.statusCode] ?? `Browser Use answered ${error.statusCode}: ${error.message}`)
  }
}
