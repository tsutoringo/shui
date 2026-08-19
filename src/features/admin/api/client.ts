import type { AdminAccess } from "~/server/modules/authorization/models";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

export type { AdminAccess };

export async function getAdminAccess() {
  return unwrapApiResponse(
    await getApiFetch()("/api/admin/access", { body: {}, headers: {}, method: "GET" }),
  );
}
