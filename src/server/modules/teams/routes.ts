import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { createDomainApiRoutes } from "../api-plugin";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  listTeams,
  removeTeamMember,
  setTeamDisabled,
  updateTeam,
} from "./service";

export function createTeamRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return createDomainApiRoutes(environment, auth, "teams")
    .get("/teams", async () => ({ teams: await listTeams(environment) }), {
      requirePermission: "teams:read",
      response: "Teams",
    })
    .post(
      "/teams",
      async ({ actor, body, request }) => createTeam(environment, actor, body, request),
      {
        body: "TeamCreateBody",
        requirePermission: "teams:write",
        response: "TeamCreated",
      },
    )
    .patch(
      "/teams/:id",
      async ({ actor, body, params, request }) =>
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
      async ({ actor, params, request }) =>
        setTeamDisabled(environment, actor, params.id, true, request),
      {
        params: "IdentifierParams",
        requirePermission: "teams:write",
        response: "TeamStatus",
      },
    )
    .post(
      "/teams/:id/enable",
      async ({ actor, params, request }) =>
        setTeamDisabled(environment, actor, params.id, false, request),
      {
        params: "IdentifierParams",
        requirePermission: "teams:write",
        response: "TeamStatus",
      },
    )
    .delete(
      "/teams/:id",
      async ({ actor, params, request }) => deleteTeam(environment, actor, params.id, request),
      {
        params: "IdentifierParams",
        requirePermission: "teams:write",
        response: "TeamStatus",
      },
    )
    .post(
      "/teams/:id/members",
      async ({ actor, body, params, request }) =>
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
      async ({ actor, params, request }) =>
        removeTeamMember(environment, actor, params.id, params.userId, request),
      {
        params: "TeamMemberParams",
        requirePermission: "teams:write",
        response: "TeamMember",
      },
    );
}
