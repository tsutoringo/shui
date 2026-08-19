import { Elysia } from "elysia";

import { CommonModels } from "../models/common";
import { shuiPlugin } from "../plugin";
import {
  createApplication,
  createApplicationClient,
  createApplicationRole,
  deleteApplication,
  deleteApplicationClient,
  deleteApplicationRole,
  grantApplicationRole,
  listApplicationClients,
  listApplicationOwners,
  listApplicationRoles,
  listApplications,
  readApplicationAccess,
  removeApplicationAssignment,
  revokeApplicationRole,
  setApplicationAssignment,
  setApplicationClientDisabled,
  setApplicationDisabled,
  transferApplicationOwnership,
  updateApplication,
  updateApplicationClient,
  updateApplicationRole,
} from "./service";
import { ApplicationModels } from "./models";

export const applicationsRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...ApplicationModels })
  .get(
    "/applications",
    async ({ environment }) => ({ applications: await listApplications(environment) }),
    {
      requirePermission: "applications:read",
      response: "Applications",
    },
  )
  .get("/applications/owners", ({ environment }) => listApplicationOwners(environment), {
    requirePermission: "owners:read",
    response: "ApplicationOwners",
  })
  .post(
    "/applications",
    async ({ actor, body, request, environment }) =>
      createApplication(environment, actor, body, request),
    {
      body: "ApplicationCreateBody",
      requirePermission: "applications:write",
      response: "Application",
    },
  )
  .patch(
    "/applications/:id",
    async ({ actor, body, params, request, environment }) =>
      updateApplication(environment, actor, params.id, body, request),
    {
      body: "ApplicationUpdateBody",
      params: "IdentifierParams",
      requirePermission: "applications:write",
      response: "Application",
    },
  )
  .post(
    "/applications/:id/transfer-ownership",
    async ({ actor, body, params, request, environment }) =>
      transferApplicationOwnership(environment, actor, params.id, body, request),
    {
      body: "OwnershipBody",
      params: "IdentifierParams",
      requirePermission: "applications:write",
      response: "Application",
    },
  )
  .post(
    "/applications/:id/disable",
    async ({ actor, params, request, environment }) =>
      setApplicationDisabled(environment, actor, params.id, true, request),
    {
      params: "IdentifierParams",
      requirePermission: "applications:write",
      response: "ApplicationStatus",
    },
  )
  .post(
    "/applications/:id/enable",
    async ({ actor, params, request, environment }) =>
      setApplicationDisabled(environment, actor, params.id, false, request),
    {
      params: "IdentifierParams",
      requirePermission: "applications:write",
      response: "ApplicationStatus",
    },
  )
  .delete(
    "/applications/:id",
    async ({ actor, params, request, environment }) =>
      deleteApplication(environment, actor, params.id, request),
    {
      params: "IdentifierParams",
      requirePermission: "applications:write",
      response: "ApplicationDeleted",
    },
  )
  .get(
    "/applications/:id/roles",
    async ({ params, environment }) => ({
      roles: await listApplicationRoles(environment, params.id),
    }),
    {
      params: "IdentifierParams",
      requirePermission: "application-roles:read",
      response: "ApplicationRoles",
    },
  )
  .post(
    "/applications/:id/roles",
    async ({ actor, body, params, request, environment }) =>
      createApplicationRole(environment, actor, params.id, body, request),
    {
      body: "ApplicationRoleCreateBody",
      params: "IdentifierParams",
      requirePermission: "application-roles:write",
      response: "ApplicationRole",
    },
  )
  .patch(
    "/applications/:id/roles/:roleKey",
    async ({ actor, body, params, request, environment }) =>
      updateApplicationRole(environment, actor, params.id, params.roleKey, body, request),
    {
      body: "ApplicationRoleUpdateBody",
      params: "ApplicationRoleParams",
      requirePermission: "application-roles:write",
      response: "ApplicationRole",
    },
  )
  .delete(
    "/applications/:id/roles/:roleKey",
    async ({ actor, params, request, environment }) =>
      deleteApplicationRole(environment, actor, params.id, params.roleKey, request),
    {
      params: "ApplicationRoleParams",
      requirePermission: "application-roles:write",
      response: "ApplicationRoleStatus",
    },
  )
  .get(
    "/applications/:id/access",
    async ({ params, environment }) => readApplicationAccess(environment, params.id),
    {
      params: "IdentifierParams",
      requirePermission: "assignments:read",
      response: "ApplicationAccess",
    },
  )
  .post(
    "/applications/:id/assignments",
    async ({ actor, body, params, request, environment }) =>
      setApplicationAssignment(environment, actor, params.id, body, request),
    {
      body: "ApplicationAssignmentBody",
      params: "IdentifierParams",
      requirePermission: "assignments:write",
      response: "ApplicationAssignment",
    },
  )
  .delete(
    "/applications/:id/assignments/:subjectType/:subjectId",
    async ({ actor, params, request, environment }) =>
      removeApplicationAssignment(
        environment,
        actor,
        params.id,
        params.subjectType,
        params.subjectId,
        request,
      ),
    {
      params: "ApplicationAssignmentParams",
      requirePermission: "assignments:write",
      response: "ApplicationAssignmentResult",
    },
  )
  .post(
    "/applications/:id/role-grants",
    async ({ actor, body, params, request, environment }) =>
      grantApplicationRole(environment, actor, params.id, body, request),
    {
      body: "ApplicationRoleGrantBody",
      params: "IdentifierParams",
      requirePermission: "application-roles:write",
      response: "ApplicationRoleGrant",
    },
  )
  .delete(
    "/applications/:id/role-grants/:subjectType/:subjectId/:roleKey",
    async ({ actor, params, request, environment }) =>
      revokeApplicationRole(
        environment,
        actor,
        params.id,
        params.subjectType,
        params.subjectId,
        params.roleKey,
        request,
      ),
    {
      params: "ApplicationRoleGrantParams",
      requirePermission: "application-roles:write",
      response: "ApplicationRoleGrant",
    },
  )
  .get(
    "/applications/:id/clients",
    async ({ params, environment }) => ({
      clients: await listApplicationClients(environment, params.id),
    }),
    {
      params: "IdentifierParams",
      requirePermission: "oidc-clients:read",
      response: "ApplicationClients",
    },
  )
  .post(
    "/applications/:id/clients",
    async ({ actor, body, params, request, environment }) =>
      createApplicationClient(environment, actor, params.id, body, request),
    {
      body: "ApplicationClientCreateBody",
      params: "IdentifierParams",
      requirePermission: "oidc-clients:write",
      response: "ApplicationClientCreated",
    },
  )
  .patch(
    "/applications/:id/clients/:clientId",
    async ({ actor, body, params, request, environment }) =>
      updateApplicationClient(environment, actor, params.id, params.clientId, body, request),
    {
      body: "ApplicationClientUpdateBody",
      params: "ApplicationClientParams",
      requirePermission: "oidc-clients:write",
      response: "ApplicationClient",
    },
  )
  .post(
    "/applications/:id/clients/:clientId/disable",
    async ({ actor, params, request, environment }) =>
      setApplicationClientDisabled(environment, actor, params.id, params.clientId, true, request),
    {
      params: "ApplicationClientParams",
      requirePermission: "oidc-clients:write",
      response: "ApplicationClient",
    },
  )
  .post(
    "/applications/:id/clients/:clientId/enable",
    async ({ actor, params, request, environment }) =>
      setApplicationClientDisabled(environment, actor, params.id, params.clientId, false, request),
    {
      params: "ApplicationClientParams",
      requirePermission: "oidc-clients:write",
      response: "ApplicationClient",
    },
  )
  .delete(
    "/applications/:id/clients/:clientId",
    async ({ actor, params, request, environment }) =>
      deleteApplicationClient(environment, actor, params.id, params.clientId, request),
    {
      params: "ApplicationClientParams",
      requirePermission: "oidc-clients:write",
      response: "ApplicationClientStatus",
    },
  );
