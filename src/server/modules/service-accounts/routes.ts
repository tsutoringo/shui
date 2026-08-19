import { Elysia } from "elysia";

import { CommonModels } from "../models/common";
import { shuiPlugin } from "../plugin";
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
import { ServiceAccountModels } from "./models";

export const serviceAccountsRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...ServiceAccountModels })
  .get(
    "/service-accounts",
    async ({ environment }) => ({ serviceAccounts: await listServiceAccounts(environment) }),
    { requirePermission: "service-accounts:read", response: "ServiceAccounts" },
  )
  .get("/service-accounts/owners", ({ environment }) => listServiceAccountOwners(environment), {
    requirePermission: "owners:read",
    response: "ServiceAccountOwners",
  })
  .get(
    "/service-accounts/:id/credentials",
    async ({ params, environment }) => ({
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
    async ({ actor, body, params, request, environment }) =>
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
    async ({ actor, body, params, request, environment }) =>
      rotateServiceAccountCredential(environment, actor, params.id, params.clientId, body, request),
    {
      body: "ServiceAccountCredentialRotateBody",
      params: "ServiceAccountCredentialParams",
      requirePermission: "service-accounts:write",
      response: "ServiceAccountCredentialCreated",
    },
  )
  .post(
    "/service-accounts/:id/credentials/:clientId/disable",
    async ({ actor, params, request, environment }) =>
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
    async ({ actor, params, request, environment }) =>
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
    async ({ actor, params, request, environment }) =>
      deleteServiceAccountCredential(environment, actor, params.id, params.clientId, request),
    {
      params: "ServiceAccountCredentialParams",
      requirePermission: "service-accounts:write",
      response: "ServiceAccountCredentialStatus",
    },
  )
  .post(
    "/service-accounts",
    async ({ actor, body, request, environment }) =>
      createServiceAccount(environment, actor, body, request),
    {
      body: "ServiceAccountCreateBody",
      requirePermission: "service-accounts:write",
      response: "ServiceAccount",
    },
  )
  .patch(
    "/service-accounts/:id",
    async ({ actor, body, params, request, environment }) =>
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
    async ({ actor, body, params, request, environment }) =>
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
    async ({ actor, params, request, environment }) =>
      setServiceAccountDisabled(environment, actor, params.id, true, request),
    {
      params: "IdentifierParams",
      requirePermission: "service-accounts:write",
      response: "ServiceAccountStatus",
    },
  )
  .post(
    "/service-accounts/:id/enable",
    async ({ actor, params, request, environment }) =>
      setServiceAccountDisabled(environment, actor, params.id, false, request),
    {
      params: "IdentifierParams",
      requirePermission: "service-accounts:write",
      response: "ServiceAccountStatus",
    },
  );
