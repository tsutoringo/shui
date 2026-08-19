import type { SystemRole } from "~/server/modules/system-roles/models";
import type { User } from "~/server/modules/users/models";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

const emptyRequest = { body: {}, headers: {} } as const;

export type { SystemRole, User };

export async function getSystemRoles() {
  return unwrapApiResponse(
    await getApiFetch()("/api/system-roles", { ...emptyRequest, method: "GET" }),
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
