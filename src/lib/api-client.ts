import type {
  BootstrapCompleteBody,
  BootstrapTokenBody,
  ApplicationAssignmentBody,
  ApplicationClientCreateBody,
  ApplicationClientUpdateBody,
  ApplicationCreateBody,
  ApplicationRoleCreateBody,
  ApplicationRoleGrantBody,
  ApplicationRoleUpdateBody,
  ApplicationUpdateBody,
  InvitationAcceptBody,
  InvitationCreateBody,
  OwnershipBody,
  ServiceAccountCreateBody,
  ServiceAccountCredentialCreateBody,
  ServiceAccountCredentialRotateBody,
  ServiceAccountUpdateBody,
  TeamCreateBody,
  TeamMemberBody,
  TeamUpdateBody,
} from "../server/modules/models";
import type { Application as ApplicationModel, Owner } from "../server/modules/models";
import { getApiFetch } from "../routes/api.$";

const emptyRequest = { body: {}, headers: {} } as const;

export type {
  ApplicationAccess,
  ApplicationClient,
  ApplicationClientCreated,
  ApplicationOwners,
  ApplicationRole,
  AdminAccess,
  BootstrapComplete,
  BootstrapReservation,
  InvitationAccepted,
  InvitationCreated,
  InvitationPublic,
  ServiceAccount,
  ServiceAccountCredential,
  ServiceAccountCredentialCreated,
  ServiceAccountCredentials,
  ServiceAccountOwners,
  SystemRole,
  Team,
  User,
} from "../server/modules/models";

export type Application = Omit<ApplicationModel, "owner"> & { owner: Owner };

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

export async function getAdminAccess() {
  return unwrapApiResponse(
    await getApiFetch()("/api/admin/access", { ...emptyRequest, method: "GET" }),
  );
}

export async function getApplications() {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications", { ...emptyRequest, method: "GET" }),
  );
}

export async function getApplicationOwners() {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/owners", { ...emptyRequest, method: "GET" }),
  );
}

export async function createApplication(body: ApplicationCreateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications", { body, headers: {}, method: "POST" }),
  );
}

export async function updateApplication(id: string, body: ApplicationUpdateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id", {
      body,
      headers: {},
      method: "PATCH",
      params: { id },
    }),
  );
}

export async function transferApplicationOwnership(id: string, body: OwnershipBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/transfer-ownership", {
      body,
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function setApplicationStatus(id: string, status: "active" | "disabled") {
  return unwrapApiResponse(
    await getApiFetch()(
      status === "active" ? "/api/applications/:id/enable" : "/api/applications/:id/disable",
      {
        ...emptyRequest,
        method: "POST",
        params: { id },
      },
    ),
  );
}

export async function deleteApplication(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id", {
      ...emptyRequest,
      method: "DELETE",
      params: { id },
    }),
  );
}

export async function getApplicationRoles(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/roles", {
      ...emptyRequest,
      method: "GET",
      params: { id },
    }),
  );
}

export async function createApplicationRole(id: string, body: ApplicationRoleCreateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/roles", {
      body,
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function updateApplicationRole(
  id: string,
  roleKey: string,
  body: ApplicationRoleUpdateBody,
) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/roles/:roleKey", {
      body,
      headers: {},
      method: "PATCH",
      params: { id, roleKey },
    }),
  );
}

export async function deleteApplicationRole(id: string, roleKey: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/roles/:roleKey", {
      ...emptyRequest,
      method: "DELETE",
      params: { id, roleKey },
    }),
  );
}

export async function getApplicationAccess(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/access", {
      ...emptyRequest,
      method: "GET",
      params: { id },
    }),
  );
}

export async function setApplicationAssignment(id: string, body: ApplicationAssignmentBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/assignments", {
      body,
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function removeApplicationAssignment(
  id: string,
  subjectType: "user" | "service-account" | "team",
  subjectId: string,
) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/assignments/:subjectType/:subjectId", {
      ...emptyRequest,
      method: "DELETE",
      params: { id, subjectType, subjectId },
    }),
  );
}

export async function grantApplicationRole(id: string, body: ApplicationRoleGrantBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/role-grants", {
      body,
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function revokeApplicationRole(
  id: string,
  subjectType: "user" | "service-account" | "team",
  subjectId: string,
  roleKey: string,
) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/role-grants/:subjectType/:subjectId/:roleKey", {
      ...emptyRequest,
      method: "DELETE",
      params: { id, roleKey, subjectId, subjectType },
    }),
  );
}

export async function getApplicationClients(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/clients", {
      ...emptyRequest,
      method: "GET",
      params: { id },
    }),
  );
}

export async function createApplicationClient(id: string, body: ApplicationClientCreateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/clients", {
      body,
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function updateApplicationClient(
  id: string,
  clientId: string,
  body: ApplicationClientUpdateBody,
) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/clients/:clientId", {
      body,
      headers: {},
      method: "PATCH",
      params: { clientId, id },
    }),
  );
}

export async function setApplicationClientStatus(
  id: string,
  clientId: string,
  status: "active" | "disabled",
) {
  return unwrapApiResponse(
    await getApiFetch()(
      status === "active"
        ? "/api/applications/:id/clients/:clientId/enable"
        : "/api/applications/:id/clients/:clientId/disable",
      {
        ...emptyRequest,
        method: "POST",
        params: { clientId, id },
      },
    ),
  );
}

export async function deleteApplicationClient(id: string, clientId: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/applications/:id/clients/:clientId", {
      ...emptyRequest,
      method: "DELETE",
      params: { clientId, id },
    }),
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

export async function getServiceAccountOwners() {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/owners", { ...emptyRequest, method: "GET" }),
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

export async function getServiceAccountCredentials(id: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/:id/credentials", {
      ...emptyRequest,
      method: "GET",
      params: { id },
    }),
  );
}

export async function createServiceAccountCredential(
  id: string,
  body: ServiceAccountCredentialCreateBody,
) {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/:id/credentials", {
      body,
      headers: {},
      method: "POST",
      params: { id },
    }),
  );
}

export async function rotateServiceAccountCredential(
  id: string,
  clientId: string,
  body: ServiceAccountCredentialRotateBody = {},
) {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/:id/credentials/:clientId/rotate", {
      body,
      headers: {},
      method: "POST",
      params: { clientId, id },
    }),
  );
}

export async function setServiceAccountCredentialStatus(
  id: string,
  clientId: string,
  status: "active" | "disabled",
) {
  return unwrapApiResponse(
    await getApiFetch()(
      status === "active"
        ? "/api/service-accounts/:id/credentials/:clientId/enable"
        : "/api/service-accounts/:id/credentials/:clientId/disable",
      {
        ...emptyRequest,
        method: "POST",
        params: { clientId, id },
      },
    ),
  );
}

export async function deleteServiceAccountCredential(id: string, clientId: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/service-accounts/:id/credentials/:clientId", {
      ...emptyRequest,
      method: "DELETE",
      params: { clientId, id },
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
