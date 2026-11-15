import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: { rules: { "*.md": { type: "text" } } },
}

export default nextConfig
