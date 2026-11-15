import { defineEvalConfig } from "eve/evals"

import { deleteProfile, findProfile } from "@/lib/browser-use"
import { db } from "@/prisma/db"
import { createTestPersona } from "@/tests/helpers"
import { createAgentToken } from "@/usecases/agent"
import { removeBrowserAndTask } from "@/usecases/browser-use"

type TestPersona = Awaited<ReturnType<typeof createTestPersona>>

// pnpm eval [ids or folders]: eve loads .env.local, runs setup, starts a local agent server and runs the evals one by one.
// Each eval makes a throwaway persona of its own with t.context.makePersona(), and every message it sends carries that persona's token in its headers: eve sends no credentials to a server it starts itself, and Persona's chat channel answers a persona only by its token.
// teardown removes every persona the run made, with the browsers, the Browser Use profile and the Autumn customer the agent made for it. A browser task can take minutes; a persona's token lasts 15
export default defineEvalConfig({
  timeoutMs: 10 * 60_000,
  maxConcurrency: 1,
  async setup() {
    const made: TestPersona[] = []

    async function makePersona() {
      const persona = await createTestPersona("eval")
      made.push(persona)

      const minted = await createAgentToken(persona.caller, persona.personaId)
      if (!minted.ok) throw new Error(minted.error.message)

      const headers = { authorization: `Bearer ${minted.value.token}` }
      return { caller: persona.caller, personaId: persona.personaId, headers }
    }

    return { made, makePersona }
  },
  async teardown(context) {
    if (!context) return

    for (const persona of context.made) {
      const browsers = await db.orm.public.Browser.where({ personaId: persona.personaId }).all()
      await Promise.all(browsers.map((browser) => removeBrowserAndTask(persona.caller, persona.personaId, browser.id).catch(() => undefined)))
      const profile = await findProfile(persona.personaId).catch(() => undefined)
      if (profile) await deleteProfile(profile.id).catch(() => undefined)
      await persona.cleanup()
    }
  },
})
