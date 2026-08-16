import { Elysia } from "elysia";

import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { requireRole } from "./service";

export function createAuthorizationPlugin(environment: AuthEnvironment, auth: AuthInstance) {
  return new Elysia({ name: "shui-m1-authorization" }).macro({
    requireRole: (roles: readonly string[]) => ({
      resolve: async ({ request }) => ({
        actor: await requireRole(auth, environment, request, roles),
      }),
    }),
  });
}
