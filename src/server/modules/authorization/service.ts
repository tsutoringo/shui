import { and, eq, isNull } from "drizzle-orm";

import { createDb } from "../../../db";
import {
  humanPrincipals,
  principals,
  systemRoleGrants,
  systemRoles,
} from "../../../db/domain-schema";
import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { ApiError } from "../errors";

export type Actor = {
  principalId: string;
  userId: string;
  roleKeys: Set<string>;
};

export const SYSTEM_ROLE_PERMISSIONS = {
  root: ["*"] as const,
  "user-admin": [
    "users:read",
    "users:write",
    "teams:read",
    "teams:write",
    "system-roles:read",
  ] as const,
  "application-admin": ["service-accounts:read", "service-accounts:write"] as const,
};

export type SystemPermission =
  (typeof SYSTEM_ROLE_PERMISSIONS)[keyof typeof SYSTEM_ROLE_PERMISSIONS][number];

export async function getActor(auth: AuthInstance, environment: AuthEnvironment, request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session?.user) throw new ApiError(401);

  const db = createDb(environment.DB);
  const principal = await db
    .select({ principalId: principals.id, userId: humanPrincipals.userId })
    .from(humanPrincipals)
    .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .where(
      and(
        eq(humanPrincipals.userId, session.user.id),
        eq(humanPrincipals.status, "active"),
        eq(humanPrincipals.disabled, false),
        eq(principals.type, "human"),
        eq(principals.status, "active"),
      ),
    )
    .get();
  if (!principal || principal.userId !== session.user.id) throw new ApiError(401);

  const roleRows = await db
    .select({ key: systemRoles.key })
    .from(systemRoleGrants)
    .innerJoin(systemRoles, eq(systemRoles.id, systemRoleGrants.roleId))
    .where(
      and(
        eq(systemRoleGrants.principalId, principal.principalId),
        isNull(systemRoleGrants.revokedAt),
      ),
    )
    .all();

  return {
    principalId: principal.principalId,
    roleKeys: new Set(roleRows.map((row) => row.key)),
    userId: session.user.id,
  } satisfies Actor;
}

export async function requireRole(
  auth: AuthInstance,
  environment: AuthEnvironment,
  request: Request,
  roles: readonly string[],
) {
  const actor = await getActor(auth, environment, request);
  if (!roles.some((role) => actor.roleKeys.has(role))) throw new ApiError(403);
  return actor;
}

export async function requirePermission(
  auth: AuthInstance,
  environment: AuthEnvironment,
  request: Request,
  permission: SystemPermission,
) {
  const actor = await getActor(auth, environment, request);
  const allowed = [...actor.roleKeys].some((roleKey) => {
    const permissions: readonly string[] =
      SYSTEM_ROLE_PERMISSIONS[roleKey as keyof typeof SYSTEM_ROLE_PERMISSIONS] ?? [];
    return permissions.includes("*") || permissions.includes(permission);
  });
  if (!allowed) throw new ApiError(403);
  return actor;
}
