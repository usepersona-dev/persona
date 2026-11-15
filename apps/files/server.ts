import { serve } from "@hono/node-server"

import worker, { type Env } from "./files.ts"

// The files Worker with Node, for Docker Compose and any server of your own: the same code Cloudflare runs, with this process's settings as its env. Each one is required
const env: Env = {
  S3_ENDPOINT: setting("S3_ENDPOINT"),
  S3_REGION: setting("S3_REGION"),
  S3_ACCESS_KEY_ID: setting("S3_ACCESS_KEY_ID"),
  S3_SECRET_ACCESS_KEY: setting("S3_SECRET_ACCESS_KEY"),
  S3_FILES_BUCKET: setting("S3_FILES_BUCKET"),
}

serve({ fetch: (request) => worker.fetch(request, env), port: 3001 })
console.log("The files Worker is listening on port 3001.")

function setting(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set.`)
  return value
}
