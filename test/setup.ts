import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { beforeAll } from "vite-plus/test";

beforeAll(async () => {
  const migrations = (env as Env & { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;
  await applyD1Migrations(env.DB, migrations);
});
