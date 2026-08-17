import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { adminAccessQueryOptions } from "~/features/admin/api/queries";
import type { AdminAccess } from "~/features/admin/api/client";
import { ApiClientError } from "~/shared/api/errors";
import { safeRedirect } from "~/features/auth/api/auth-api";
import { hasAdminPermission, type AdminRoutePermission } from "~/features/admin/routing/policy";

export async function requireAdminAccess(queryClient: QueryClient, from: string) {
  try {
    return await queryClient.fetchQuery({ ...adminAccessQueryOptions, staleTime: 0 });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: safeRedirect(from, "/admin") },
      });
    }

    if (error instanceof ApiClientError && error.status === 403) {
      throw redirect({
        to: "/forbidden",
        search: { from: safeRedirect(from, "/admin") },
      });
    }

    throw error;
  }
}

export function requireAdminPermission(
  access: AdminAccess,
  permission: AdminRoutePermission,
  from: string,
) {
  if (hasAdminPermission(access, permission)) return;

  throw redirect({
    to: "/forbidden",
    search: { from: safeRedirect(from, "/admin") },
  });
}
