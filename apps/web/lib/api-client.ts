type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function request<T>(method: Method, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" }
    init.body = JSON.stringify(body)
  }

  const response = await fetch(url, init)
  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? "server_error", data?.error?.message ?? "Something went wrong. Try again.")

  return data as T
}

export async function fetcher<T>(url: string): Promise<T> {
  const data = await request<T>("GET", url)
  return data
}

export async function uploadTo(uploadUrl: string, file: Blob, contentType: string) {
  const response = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file })
  if (!response.ok) throw new ApiError(response.status, "upload_failed", "The upload did not finish. Try again.")
}
