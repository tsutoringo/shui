import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { createDomainApiRoutes } from "../api-plugin";
import { requireAdminAccess } from "./service";

export function createAuthorizationRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return createDomainApiRoutes(environment, auth, "authorization").get(
    "/admin/access",
    ({ request }) => requireAdminAccess(auth, environment, request),
    { response: "AdminAccess" },
  );
}
