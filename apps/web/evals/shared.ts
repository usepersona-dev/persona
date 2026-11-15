import { setTimeout as sleep } from "node:timers/promises"

import type { EveEvalTurn } from "eve/evals"

/** A word no page and no model would write by itself, so finding it anywhere proves it came from the eval. */
export function marker(prefix: string) {
  const word = `${prefix}-${Math.random().toString(36).slice(2, 10)}`
  return word
}

/** Reads every two seconds until read returns something, or gives up after timeoutMs. */
export async function waitFor<T>(read: () => Promise<T | undefined>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await read()
    if (value !== undefined) return value
    await sleep(2000)
  }
  return undefined
}

/** What the person was sent in a turn: the text of each chat_say, in order. The persona talks only through the chat tools, so the turn's own message is its closing note, which nobody sees. */
export function said(turn: EveEvalTurn) {
  const texts = turn.toolCalls.filter((call) => call.name === "chat_say").map((call) => String(call.input.text ?? ""))
  return texts.join("\n")
}
