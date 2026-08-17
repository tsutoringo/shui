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
import {
  createServiceAccountCredential,
  deleteServiceAccountCredential,
  listServiceAccountCredentials,
  rotateServiceAccountCredential,
  setServiceAccountCredentialDisabled,
} from "./credentials";

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
    .get(
      "/service-accounts/:id/credentials",
      async ({ params }) => ({
        credentials: await listServiceAccountCredentials(environment, params.id),
      }),
      {
        params: "IdentifierParams",
        requirePermission: "service-accounts:read",
        response: "ServiceAccountCredentials",
      },
    )
    .post(
      "/service-accounts/:id/credentials",
      async ({ actor, body, params, request }) =>
        createServiceAccountCredential(environment, actor, params.id, body, request),
      {
        body: "ServiceAccountCredentialCreateBody",
        params: "IdentifierParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccountCredentialCreated",
      },
    )
    .post(
      "/service-accounts/:id/credentials/:clientId/rotate",
      async ({ actor, body, params, request }) =>
        rotateServiceAccountCredential(
          environment,
          actor,
          params.id,
          params.clientId,
          body,
          request,
        ),
      {
        body: "ServiceAccountCredentialRotateBody",
        params: "ServiceAccountCredentialParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccountCredentialCreated",
      },
    )
    .post(
      "/service-accounts/:id/credentials/:clientId/disable",
      async ({ actor, params, request }) =>
        setServiceAccountCredentialDisabled(
          environment,
          actor,
          params.id,
          params.clientId,
          true,
          request,
        ),
      {
        params: "ServiceAccountCredentialParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccountCredential",
      },
    )
    .post(
      "/service-accounts/:id/credentials/:clientId/enable",
      async ({ actor, params, request }) =>
        setServiceAccountCredentialDisabled(
          environment,
          actor,
          params.id,
          params.clientId,
          false,
          request,
        ),
      {
        params: "ServiceAccountCredentialParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccountCredential",
      },
    )
    .delete(
      "/service-accounts/:id/credentials/:clientId",
      async ({ actor, params, request }) =>
        deleteServiceAccountCredential(environment, actor, params.id, params.clientId, request),
      {
        params: "ServiceAccountCredentialParams",
        requirePermission: "service-accounts:write",
        response: "ServiceAccountCredentialStatus",
      },
    )
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
