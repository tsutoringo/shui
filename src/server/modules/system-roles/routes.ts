import { Elysia } from "elysia";

import { CommonModels } from "../models/common";
import { shuiPlugin } from "../plugin";
import { SystemRoleModels } from "./models";
import { grantSystemRole, listSystemRoles, revokeSystemRole } from "./service";

export const systemRolesRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...SystemRoleModels })
  .get(
    "/system-roles",
    async ({ environment }) => ({ roles: await listSystemRoles(environment) }),
    {
      requirePermission: "system-roles:read",
      response: "SystemRoles",
    },
  )
  .post(
    "/users/:id/system-roles",
    async ({ actor, body, params, request, environment }) =>
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
    async ({ actor, params, request, environment }) =>
      revokeSystemRole(environment, actor, params.id, params.roleKey, request),
    {
      params: "UserRoleParams",
      requirePermission: "*",
      response: "SystemRoleGrant",
    },
  );
