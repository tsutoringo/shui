import { Elysia } from "elysia";

import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { requirePermission, requireRole, type SystemPermission } from "./service";

export function createAuthorizationPlugin(environment: AuthEnvironment, auth: AuthInstance) {
  return new Elysia({ name: "shui-authorization" }).macro({
    requireRole: (roles: readonly string[]) => ({
      resolve: async ({ request }) => ({
        actor: await requireRole(auth, environment, request, roles),
      }),
    }),
    requirePermission: (permission: SystemPermission) => ({
      resolve: async ({ request }) => ({
        actor: await requirePermission(auth, environment, request, permission),
      }),
    }),
  });
}
