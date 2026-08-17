import type {
  BootstrapCompleteBody,
  BootstrapTokenBody,
  InvitationAcceptBody,
  InvitationCreateBody,
  OwnershipBody,
  ServiceAccountCreateBody,
  ServiceAccountUpdateBody,
  TeamCreateBody,
  TeamMemberBody,
  TeamUpdateBody,
} from "../server/modules/models";
import { getApiFetch } from "../routes/api.$";

const emptyRequest = { body: {}, headers: {} } as const;

export type {
  BootstrapComplete,
  BootstrapReservation,
  InvitationAccepted,
  InvitationCreated,
  InvitationPublic,
  ServiceAccount,
  SystemRole,
  Team,
  User,
} from "../server/modules/models";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function reserveBootstrap(body: BootstrapTokenBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/setup/reserve", { body, headers: {}, method: "POST" }),
  );
}

export async function completeBootstrap(body: BootstrapCompleteBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/setup/complete", { body, headers: {}, method: "POST" }),
  );
}

export async function createInvitation(body: InvitationCreateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/invitations", { body, headers: {}, method: "POST" }),
  );
}

export async function getInvitation(token: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/invitations/:token", {
      ...emptyRequest,
      method: "GET",
      params: { token },
    }),
  );
}

export async function acceptInvitation(token: string, body: InvitationAcceptBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/invitations/:token/accept", {
      body,
      headers: {},
      method: "POST",
      params: { token },
    }),
  );
}

export async function getUsers() {
  return unwrapApiResponse(await getApiFetch()("/api/users", { ...emptyRequest, method: "GET" }));
}

export async function repairUser(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/users/:id/repair", {
      ...emptyRequest,
      method: "POST",
      params: { id },
    }),
  );
}

export async function setUserStatus(id: string, status: "active" | "disabled") {
  if (status === "disabled") {
    return unwrapApiResponse(
      await getApiFetch()("/api/users/:id/disable", {
        ...emptyRequest,
        method: "POST",
        params: { id },
      }),
    );
  }

  return unwrapApiResponse(
    await getApiFetch()("/api/users/:id/enable", {
      ...emptyRequest,
      method: "POST",
      params: { id },
    }),
  );
}

export async function grantUserRole(id: string, roleKey: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/users/:id/system-roles", {
      body: { roleKey },
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function revokeUserRole(id: string, roleKey: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/users/:id/system-roles/:roleKey", {
      ...emptyRequest,
      method: "DELETE",
      params: { id, roleKey },
    }),
  );
}

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
    await getApiFetch()("/api/teams/:id", {
      body,
      headers: {},
      method: "PATCH",
      params: { id },
    }),
  );
}

export async function setTeamStatus(id: string, status: "active" | "disabled") {
  if (status === "disabled") {
    return unwrapApiResponse(
      await getApiFetch()("/api/teams/:id/disable", {
        ...emptyRequest,
        method: "POST",
        params: { id },
      }),
    );
  }

  return unwrapApiResponse(
    await getApiFetch()("/api/teams/:id/enable", {
      ...emptyRequest,
      method: "POST",
      params: { id },
    }),
  );
}

export async function deleteTeam(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/teams/:id", {
      ...emptyRequest,
      method: "DELETE",
      params: { id },
    }),
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

export async function getServiceAccounts() {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts", { ...emptyRequest, method: "GET" }),
  );
}

export async function createServiceAccount(body: ServiceAccountCreateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts", { body, headers: {}, method: "POST" }),
  );
}

export async function updateServiceAccount(id: string, body: ServiceAccountUpdateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/:id", {
      body,
      headers: {},
      method: "PATCH",
      params: { id },
    }),
  );
}

export async function transferServiceAccount(id: string, body: OwnershipBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/:id/transfer-ownership", {
      body,
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function setServiceAccountStatus(id: string, status: "active" | "disabled") {
  if (status === "disabled") {
    return unwrapApiResponse(
      await getApiFetch()("/api/service-accounts/:id/disable", {
        ...emptyRequest,
        method: "POST",
        params: { id },
      }),
    );
  }

  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/:id/enable", {
      ...emptyRequest,
      method: "POST",
      params: { id },
    }),
  );
}

export async function getSystemRoles() {
  return unwrapApiResponse(
    await getApiFetch()("/api/system-roles", { ...emptyRequest, method: "GET" }),
  );
}

function unwrapApiResponse<T>(response: { data: T | null; error: unknown; status: number }) {
  if (response.error || response.data === null) {
    throw new ApiClientError(readErrorMessage(response.error), response.status);
  }

  return response.data;
}

function readErrorMessage(value: unknown) {
  if (value && typeof value === "object" && "value" in value) {
    return readErrorMessage(value.value);
  }

  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }

  return "The request could not be completed.";
}

export function formatApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in with an administrator account to continue.";
    if (error.status === 403) return "Your system role does not allow this action.";
    if (error.status === 409) return "The change conflicts with the current identity state.";
    if (error.status === 429) return "Too many attempts. Wait a moment and try again.";
    return error.message;
  }

  return error instanceof Error && error.message
    ? error.message
    : "The request could not be completed.";
}
