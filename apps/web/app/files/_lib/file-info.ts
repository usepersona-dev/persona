// What a file is and how to name it, for the file page (files.usepersona.dev)

export type Kind = "html" | "image" | "pdf" | "video" | "audio" | "markdown" | "text" | "large" | "other"

export type FileInfo = { name: string; contentType: string; size: number }

const TEXT_TYPES = ["application/json", "application/xml", "application/javascript", "application/yaml", "application/x-yaml", "application/x-sh", "application/sql"]
const TEXT_LIMIT = 1_000_000

// How the file page shows it. Text over 1 MB is too big to read in the page.
export function kindOf(file: FileInfo): Kind {
  const type = file.contentType
  if (type === "text/html") return "html"
  if (type.startsWith("image/")) return "image"
  if (type === "application/pdf") return "pdf"
  if (type.startsWith("video/")) return "video"
  if (type.startsWith("audio/")) return "audio"

  const markdown = type === "text/markdown" || file.name.toLowerCase().endsWith(".md")
  const text = type.startsWith("text/") || TEXT_TYPES.includes(type)
  if ((markdown || text) && file.size > TEXT_LIMIT) return "large"
  if (markdown) return "markdown"
  if (text) return "text"
  return "other"
}

// The file's extension in capitals (PDF, CSV), else its type
export function typeLabel(file: FileInfo) {
  const extension = file.name.includes(".") ? file.name.split(".").at(-1) : undefined
  const label = extension ? extension.toUpperCase() : file.contentType
  return label
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`

  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value = value / 1024
    unit = unit + 1
  }

  const size = `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
  return size
}
