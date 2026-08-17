import type { Team, TeamCreateBody, TeamMemberBody, TeamUpdateBody } from "~/server/modules/models";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

const emptyRequest = { body: {}, headers: {} } as const;

export type { Team };

export async function getTeams() {
  return unwrapApiResponse(await getApiFetch()("/api/teams", { ...emptyRequest, method: "GET" }));
}

export async function createTeam(body: TeamCreateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/teams", { body, headers: {}, method: "POST" }),
  );
}

export async function updateTeam(id: string, body: TeamUpdateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/teams/:id", { body, headers: {}, method: "PATCH", params: { id } }),
  );
}

export async function setTeamStatus(id: string, status: "active" | "disabled") {
  return unwrapApiResponse(
    await getApiFetch()(
      status === "disabled" ? "/api/teams/:id/disable" : "/api/teams/:id/enable",
      { ...emptyRequest, method: "POST", params: { id } },
    ),
  );
}

export async function deleteTeam(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/teams/:id", { ...emptyRequest, method: "DELETE", params: { id } }),
  );
}

export async function addTeamMember(teamId: string, body: TeamMemberBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/teams/:id/members", {
      body,
      headers: {},
      method: "POST",
      params: { id: teamId },
    }),
  );
}

export async function removeTeamMember(teamId: string, userId: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/teams/:id/members/:userId", {
      ...emptyRequest,
      method: "DELETE",
      params: { id: teamId, userId },
    }),
  );
}
