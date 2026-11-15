import type { z } from "zod"

export type FailureCode = "not_found" | "invalid" | "conflict"
export type Failure = { code: FailureCode; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure }
export type Output<F extends (...args: never[]) => unknown> = Extract<Awaited<ReturnType<F>>, { ok: true }> extends { value: infer V } ? V : never

export function ok<T>(value: T): Result<T> {
  const result: Result<T> = { ok: true, value }
  return result
}

export function err(code: FailureCode, message: string): { ok: false; error: Failure } {
  const result = { ok: false as const, error: { code, message } }
  return result
}

export function validate<T extends z.ZodType>(schema: T, input: unknown): Result<z.output<T>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return err("invalid", parsed.error.issues[0]?.message ?? "Something in the request is not valid.")

  const result = ok(parsed.data)
  return result
}

export function withoutUndefined<T extends Record<string, unknown>>(input: T) {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined)
  const result = Object.fromEntries(entries) as { [K in keyof T]?: Exclude<T[K], undefined> }
  return result
}
