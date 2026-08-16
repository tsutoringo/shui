import { drizzle } from "drizzle-orm/d1";

import * as schema from "./auth-schema";
import * as domainSchema from "./domain-schema";

const appSchema = { ...schema, ...domainSchema };

export function createDb(database: D1Database) {
  return drizzle(database, { schema: appSchema });
}

export type AppDb = ReturnType<typeof createDb>;
