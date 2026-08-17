import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { createDb } from "../../../db";
import { createDomainApiRoutes } from "../api-plugin";
import { listUsers, repairHumanPrincipal, setUserDisabled } from "./service";

export function createUserRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return createDomainApiRoutes(environment, auth, "users")
    .get("/users", async () => ({ users: await listUsers(createDb(environment.DB)) }), {
      requirePermission: "users:read",
      response: "Users",
    })
    .post(
      "/users/:id/repair",
      async ({ actor, params, request }) =>
        repairHumanPrincipal(environment, actor, params.id, request),
      {
        params: "IdentifierParams",
        requirePermission: "users:write",
        response: "UserRepair",
      },
    )
    .post(
      "/users/:id/disable",
      async ({ actor, params, request }) =>
        setUserDisabled(environment, actor, params.id, true, request),
      {
        params: "UserParams",
        requirePermission: "users:write",
        response: "UserStatus",
      },
    )
    .post(
      "/users/:id/enable",
      async ({ actor, params, request }) =>
        setUserDisabled(environment, actor, params.id, false, request),
      {
        params: "UserParams",
        requirePermission: "users:write",
        response: "UserStatus",
      },
    );
}
