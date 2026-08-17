import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { createDomainApiRoutes } from "../api-plugin";
import { grantSystemRole, listSystemRoles, revokeSystemRole } from "./service";

export function createSystemRoleRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return createDomainApiRoutes(environment, auth, "system-roles")
    .get("/system-roles", async () => ({ roles: await listSystemRoles(environment) }), {
      requirePermission: "system-roles:read",
      response: "SystemRoles",
    })
    .post(
      "/users/:id/system-roles",
      async ({ actor, body, params, request }) =>
        grantSystemRole(environment, actor, params.id, body.roleKey, request),
      {
        body: "SystemRoleGrantBody",
        params: "IdentifierParams",
        requirePermission: "*",
        response: "SystemRoleGrant",
      },
    )
    .delete(
      "/users/:id/system-roles/:roleKey",
      async ({ actor, params, request }) =>
        revokeSystemRole(environment, actor, params.id, params.roleKey, request),
      {
        params: "UserRoleParams",
        requirePermission: "*",
        response: "SystemRoleGrant",
      },
    );
}
