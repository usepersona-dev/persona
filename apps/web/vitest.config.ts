import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

// Two kinds of tests. Unit tests check code on its own and get no keys, so they run anywhere.
// Integration tests run the real code on the dev database and real services, so only they get the keys: Vite's loadEnv reads them from .env, .env.local, .env.test and .env.test.local. Some take minutes, so they have no time limit, as under Node's test runner
export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    passWithNoTests: true,
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      { test: { name: "integration", include: ["tests/integration/**/*.test.ts"], env: loadEnv(mode, process.cwd(), ""), testTimeout: 0, hookTimeout: 0 } },
    ],
  },
}))
