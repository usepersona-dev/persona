import { handler, optionalHandler, readJson } from "@/app/api/handler"
import { completeFileReplace, getFileView, removeFile, updateFile } from "@/usecases/files"

type Params = { fileId: string }

export const GET = optionalHandler<Params>(async (caller, { fileId }) => {
  const file = await getFileView(fileId, caller)
  return file
})

export const PATCH = handler<Params>(async (caller, { fileId }, request) => {
  const input = await readJson(request)
  if (!input.ok) return input
  const file = await updateFile(caller, fileId, input.value)
  return file
})

export const PUT = handler<Params>(async (caller, { fileId }) => {
  const file = await completeFileReplace(caller, fileId)
  return file
})

export const DELETE = handler<Params>(async (caller, { fileId }) => {
  const removed = await removeFile(caller, fileId)
  return removed
})
