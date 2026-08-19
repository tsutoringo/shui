import { Elysia } from "elysia";

import { ApiError } from "./errors";
import { assertMutationOrigin } from "./http";
import { authorizationRoute } from "./authorization/routes";
import { applicationsRoute } from "./applications/routes";
import { bootstrapRoute } from "./bootstrap/routes";
import { invitationsRoute } from "./invitations/routes";
import { shuiPlugin } from "./plugin";
import { serviceAccountsRoute } from "./service-accounts/routes";
import { systemRolesRoute } from "./system-roles/routes";
import { teamsRoute } from "./teams/routes";
import { usersRoute } from "./users/routes";

export const shuiApiRoutes = new Elysia({ name: "shui-api-routes", normalize: false })
  .use(shuiPlugin)
  .error({ ApiError })
  .onBeforeHandle(({ request, set, environment }) => {
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
  .use(authorizationRoute)
  .use(applicationsRoute)
  .use(bootstrapRoute)
  .use(invitationsRoute)
  .use(usersRoute)
  .use(systemRolesRoute)
  .use(teamsRoute)
  .use(serviceAccountsRoute);
