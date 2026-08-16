import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/auth-schema.ts", "./src/db/domain-schema.ts"],
  out: "./migrations",
  dialect: "sqlite",
});
