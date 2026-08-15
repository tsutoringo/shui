import path from "node:path";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: "./src/test-worker.ts",
      miniflare: {
        compatibilityDate: "2026-08-11",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          BETTER_AUTH_SECRET: "test-secret-for-shui-worker-runtime-32-chars",
          BETTER_AUTH_URL: "http://localhost:8787",
          TEST_MIGRATIONS: await readD1Migrations(path.resolve("migrations")),
        },
      },
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    })),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
