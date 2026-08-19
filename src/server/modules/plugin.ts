import { Elysia } from "elysia";
import { env } from "cloudflare:workers";

import { getAuth } from "../auth";
import { requirePermission, requireRole, type SystemPermission } from "./authorization/service";

export const shuiPlugin = new Elysia({ name: "shui-plugin" })
  .decorate("environment", env)
  .derive(() => ({
    auth: getAuth(),
  }))
  .macro({
    requireRole: (roles: readonly string[]) => ({
      resolve: async ({ request, environment, auth }) => ({
        actor: await requireRole(auth!, environment, request, roles),
      }),
    }),
    requirePermission: (permission: SystemPermission) => ({
      resolve: async ({ request, environment, auth }) => ({
        actor: await requirePermission(auth!, environment, request, permission),
      }),
    }),
  })
  .as("scoped");
