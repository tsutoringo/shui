import type {
  Application as ApplicationModel,
  ApplicationAccess,
  ApplicationAssignmentBody,
  ApplicationClient,
  ApplicationClientCreateBody,
  ApplicationClientCreated,
  ApplicationClientUpdateBody,
  ApplicationCreateBody,
  ApplicationOwners,
  ApplicationRole,
  ApplicationRoleCreateBody,
  ApplicationRoleGrantBody,
  ApplicationRoleUpdateBody,
  ApplicationUpdateBody,
} from "~/server/modules/applications/models";
import type { Owner, OwnershipBody } from "~/server/modules/models/common";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

const emptyRequest = { body: {}, headers: {} } as const;

export type {
  ApplicationAccess,
  ApplicationClient,
  ApplicationClientCreated,
  ApplicationOwners,
  ApplicationRole,
};

export type Application = Omit<ApplicationModel, "owner"> & { owner: Owner };

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
      { ...emptyRequest, method: "POST", params: { id } },
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
      params: { id, subjectId, subjectType },
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
      { ...emptyRequest, method: "POST", params: { clientId, id } },
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
