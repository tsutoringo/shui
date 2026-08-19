import { Elysia } from "elysia";

import { CommonModels } from "../models/common";
import { shuiPlugin } from "../plugin";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  listTeams,
  removeTeamMember,
  setTeamDisabled,
  updateTeam,
} from "./service";
import { TeamModels } from "./models";

export const teamsRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...TeamModels })
  .get("/teams", async ({ environment }) => ({ teams: await listTeams(environment) }), {
    requirePermission: "teams:read",
    response: "Teams",
  })
  .post(
    "/teams",
    async ({ actor, body, request, environment }) => createTeam(environment, actor, body, request),
    {
      body: "TeamCreateBody",
      requirePermission: "teams:write",
      response: "TeamCreated",
    },
  )
  .patch(
    "/teams/:id",
    async ({ actor, body, params, request, environment }) =>
      updateTeam(environment, actor, params.id, body, request),
    {
      body: "TeamUpdateBody",
      params: "IdentifierParams",
      requirePermission: "teams:write",
      response: "TeamCreated",
    },
  )
  .post(
    "/teams/:id/disable",
    async ({ actor, params, request, environment }) =>
      setTeamDisabled(environment, actor, params.id, true, request),
    {
      params: "IdentifierParams",
      requirePermission: "teams:write",
      response: "TeamStatus",
    },
  )
  .post(
    "/teams/:id/enable",
    async ({ actor, params, request, environment }) =>
      setTeamDisabled(environment, actor, params.id, false, request),
    {
      params: "IdentifierParams",
      requirePermission: "teams:write",
      response: "TeamStatus",
    },
  )
  .delete(
    "/teams/:id",
    async ({ actor, params, request, environment }) =>
      deleteTeam(environment, actor, params.id, request),
    {
      params: "IdentifierParams",
      requirePermission: "teams:write",
      response: "TeamStatus",
    },
  )
  .post(
    "/teams/:id/members",
    async ({ actor, body, params, request, environment }) =>
      addTeamMember(environment, actor, params.id, body.userId, request),
    {
      body: "TeamMemberBody",
      params: "IdentifierParams",
      requirePermission: "teams:write",
      response: "TeamMember",
    },
  )
  .delete(
    "/teams/:id/members/:userId",
    async ({ actor, params, request, environment }) =>
      removeTeamMember(environment, actor, params.id, params.userId, request),
    {
      params: "TeamMemberParams",
      requirePermission: "teams:write",
      response: "TeamMember",
    },
  );
