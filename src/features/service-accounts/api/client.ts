import type { Application } from "~/server/modules/applications/models";
import type { OwnershipBody } from "~/server/modules/models/common";
import type {
  ServiceAccount,
  ServiceAccountCredential,
  ServiceAccountCredentialCreateBody,
  ServiceAccountCredentialCreated,
  ServiceAccountCredentialRotateBody,
  ServiceAccountCredentials,
  ServiceAccountCreateBody,
  ServiceAccountOwners,
  ServiceAccountUpdateBody,
} from "~/server/modules/service-accounts/models";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

const emptyRequest = { body: {}, headers: {} } as const;

export type {
  Application,
  ServiceAccount,
  ServiceAccountCredential,
  ServiceAccountCredentialCreated,
  ServiceAccountCredentials,
  ServiceAccountOwners,
};

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
  return unwrapApiResponse(
    await getApiFetch()(
      status === "disabled"
        ? "/api/service-accounts/:id/disable"
        : "/api/service-accounts/:id/enable",
      { ...emptyRequest, method: "POST", params: { id } },
    ),
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
      { ...emptyRequest, method: "POST", params: { clientId, id } },
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
