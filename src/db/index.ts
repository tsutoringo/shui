import { drizzle } from "drizzle-orm/d1";

import * as schema from "./auth-schema";

export function createDb(database: D1Database) {
  return drizzle(database, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
