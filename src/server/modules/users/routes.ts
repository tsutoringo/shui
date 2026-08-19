import { createDb } from "../../../db";
import { CommonModels } from "../models/common";
import { UserModels } from "./models";
import { listUsers, repairHumanPrincipal, setUserDisabled } from "./service";
import Elysia from "elysia";
import { shuiPlugin } from "../plugin";

export const usersRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...UserModels })
  .get(
    "/users",
    async ({ environment }) => ({ users: await listUsers(createDb(environment.DB)) }),
    {
      requirePermission: "users:read",
      response: "Users",
    },
  )
  .post(
    "/users/:id/repair",
    async ({ actor, params, request, environment }) =>
      repairHumanPrincipal(environment, actor, params.id, request),
    {
      params: "IdentifierParams",
      requirePermission: "users:write",
      response: "UserRepair",
    },
  )
  .post(
    "/users/:id/disable",
    async ({ actor, params, request, environment }) =>
      setUserDisabled(environment, actor, params.id, true, request),
    {
      params: "UserParams",
      requirePermission: "users:write",
      response: "UserStatus",
    },
  )
  .post(
    "/users/:id/enable",
    async ({ actor, params, request, environment }) =>
      setUserDisabled(environment, actor, params.id, false, request),
    {
      params: "UserParams",
      requirePermission: "users:write",
      response: "UserStatus",
    },
  );
