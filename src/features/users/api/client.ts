import type { User } from "~/server/modules/models";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

const emptyRequest = { body: {}, headers: {} } as const;

export type { User };

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
  return unwrapApiResponse(
    await getApiFetch()(
      status === "disabled" ? "/api/users/:id/disable" : "/api/users/:id/enable",
      { ...emptyRequest, method: "POST", params: { id } },
    ),
  );
}
