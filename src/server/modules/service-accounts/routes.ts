import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { createDomainApiRoutes } from "../api-plugin";
import {
  createServiceAccount,
  listServiceAccounts,
  listServiceAccountOwners,
  setServiceAccountDisabled,
  transferServiceAccountOwnership,
  updateServiceAccount,
} from "./service";

export function createServiceAccountRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return createDomainApiRoutes(environment, auth, "service-accounts")
    .get(
      "/service-accounts",
      async () => ({ serviceAccounts: await listServiceAccounts(environment) }),
      { requirePermission: "service-accounts:read", response: "ServiceAccounts" },
    )
    .get("/service-accounts/owners", () => listServiceAccountOwners(environment), {
      requirePermission: "owners:read",
      response: "ServiceAccountOwners",
    })
    .post(
      "/service-accounts",
      async ({ actor, body, request }) => createServiceAccount(environment, actor, body, request),
      {
        body: "ServiceAccountCreateBody",
        requirePermission: "service-accounts:write",
        response: "ServiceAccount",
      },
    )
    .patch(
      "/service-accounts/:id",
      async ({ actor, body, params, request }) =>
        updateServiceAccount(environment, actor, params.id, body, request),
      {
        body: "ServiceAccountUpdateBody",
        params: "IdentifierParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccount",
      },
    )
    .post(
      "/service-accounts/:id/transfer-ownership",
      async ({ actor, body, params, request }) =>
        transferServiceAccountOwnership(environment, actor, params.id, body, request),
      {
        body: "OwnershipBody",
        params: "IdentifierParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccount",
      },
    )
    .post(
      "/service-accounts/:id/disable",
      async ({ actor, params, request }) =>
        setServiceAccountDisabled(environment, actor, params.id, true, request),
      {
        params: "IdentifierParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccountStatus",
      },
    )
    .post(
      "/service-accounts/:id/enable",
      async ({ actor, params, request }) =>
        setServiceAccountDisabled(environment, actor, params.id, false, request),
      {
        params: "IdentifierParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccountStatus",
      },
    );
}
