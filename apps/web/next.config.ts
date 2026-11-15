import type { NextConfig } from "next"
import { withEve } from "eve/next"

// On every answer of the app and of its file pages: no other site may show a page in a frame, the browser does not guess a file's type, and other sites do not learn the address a person came from
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
]

const nextConfig: NextConfig = {
  turbopack: { rules: { "*.md": { type: "text" } } },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }]
  },
}

export default withEve(nextConfig)
