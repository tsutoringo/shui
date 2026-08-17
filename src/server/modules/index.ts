import { Elysia } from "elysia";

import { type AuthEnvironment, type AuthInstance } from "../auth";
import { ApiError } from "./errors";
import { assertMutationOrigin } from "./http";
import { createBootstrapRoutes } from "./bootstrap/routes";
import { createInvitationRoutes } from "./invitations/routes";
import { createServiceAccountRoutes } from "./service-accounts/routes";
import { createSystemRoleRoutes } from "./system-roles/routes";
import { createTeamRoutes } from "./teams/routes";
import { createUserRoutes } from "./users/routes";

export function createApiRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return new Elysia({ name: "shui-api-routes", normalize: false })
    .error({ ApiError })
    .onBeforeHandle(({ request, set }) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        assertMutationOrigin(environment, request);
      }
      set.headers["cache-control"] = "no-store";
      set.headers.pragma = "no-cache";
    })
    .onError(({ code, error, set }) => {
      set.headers["cache-control"] = "no-store";
      set.headers.pragma = "no-cache";
      const statusCode =
        error instanceof ApiError ? error.statusCode : code === "VALIDATION" ? 400 : 500;
      set.status = statusCode;
      return {
        error: statusCode >= 500 ? "Request failed." : "The request could not be completed.",
      };
    })
    .use(createBootstrapRoutes(environment, auth))
    .use(createInvitationRoutes(environment, auth))
    .use(createUserRoutes(environment, auth))
    .use(createSystemRoleRoutes(environment, auth))
    .use(createTeamRoutes(environment, auth))
    .use(createServiceAccountRoutes(environment, auth));
}
