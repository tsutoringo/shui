import { and, eq, isNull, sql } from "drizzle-orm";

import { createDb } from "../../../db";
import {
  humanPrincipals,
  principals,
  systemRoleGrants,
  systemRoles,
} from "../../../db/domain-schema";
import { type AuthEnvironment } from "../../auth";
import { type Actor } from "../authorization/service";
import { ApiError } from "../errors";
import { activeRootCount, resolveHumanPrincipal } from "../users/service";
import {
  auditStatementWhen,
  enforceRateLimit,
  outboxStatementWhen,
} from "../../shared/infrastructure";

export async function listSystemRoles(environment: AuthEnvironment) {
  const db = createDb(environment.DB);
  const roles = await db.select().from(systemRoles).orderBy(systemRoles.key).all();
  const grants = await db
    .select({ roleId: systemRoleGrants.roleId })
    .from(systemRoleGrants)
    .innerJoin(principals, eq(principals.id, systemRoleGrants.principalId))
    .where(and(isNull(systemRoleGrants.revokedAt), eq(principals.status, "active")))
    .all();
  const counts = new Map<string, number>();
  for (const grant of grants) counts.set(grant.roleId, (counts.get(grant.roleId) ?? 0) + 1);

  return roles.map((role) => ({
    key: role.key,
    name: role.name,
    description: role.description,
    activeGrantCount: counts.get(role.id) ?? 0,
  }));
}

export async function grantSystemRole(
  environment: AuthEnvironment,
  actor: Actor,
  identifier: string,
  roleKey: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "system-role-grant", 120, 60);
  const db = createDb(environment.DB);
  const target = await resolveHumanPrincipal(db, identifier);
  if (!target || target.principal_status !== "active" || target.human_status !== "active") {
    throw new ApiError(409);
  }
  const role = await db
    .select({ id: systemRoles.id, key: systemRoles.key })
    .from(systemRoles)
    .where(eq(systemRoles.key, roleKey))
    .get();
  if (!role) throw new ApiError(400);

  const current = await db
    .select({ id: systemRoleGrants.id, revokedAt: systemRoleGrants.revokedAt })
    .from(systemRoleGrants)
    .where(
      and(
        eq(systemRoleGrants.principalId, target.principal_id),
        eq(systemRoleGrants.roleId, role.id),
      ),
    )
    .get();
  if (current && current.revokedAt === null) {
    return {
      principalId: target.principal_id,
      roleKey: role.key,
      status: "granted" as const,
      userId: target.user_id,
    };
  }

  const now = Date.now();
  const grantId = current?.id ?? `system-role:${target.principal_id}:${role.id}`;
  const mutation = current
    ? db
        .update(systemRoleGrants)
        .set({ grantedByPrincipalId: actor.principalId, revokedAt: null, createdAt: now })
        .where(eq(systemRoleGrants.id, grantId))
        .returning({ id: systemRoleGrants.id })
    : db
        .insert(systemRoleGrants)
        .values({
          id: grantId,
          principalId: target.principal_id,
          roleId: role.id,
          grantedByPrincipalId: actor.principalId,
          revokedAt: null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [systemRoleGrants.principalId, systemRoleGrants.roleId],
          set: { grantedByPrincipalId: actor.principalId, revokedAt: null, createdAt: now },
        })
        .returning({ id: systemRoleGrants.id });
  const activeGrant = db
    .select({ value: systemRoleGrants.id })
    .from(systemRoleGrants)
    .where(
      and(
        eq(systemRoleGrants.principalId, target.principal_id),
        eq(systemRoleGrants.roleId, role.id),
        isNull(systemRoleGrants.revokedAt),
      ),
    );
  const result = await db.batch([
    mutation,
    auditStatementWhen(
      db,
      `system-role:granted:${target.principal_id}:${role.key}:${now}`,
      "system_role.granted",
      actor.principalId,
      target.principal_id,
      target.user_id,
      { roleKey: role.key },
      now,
      activeGrant,
    ),
    outboxStatementWhen(
      db,
      `system-role:granted:outbox:${target.principal_id}:${role.key}:${now}`,
      "system_role.granted",
      "principal",
      target.principal_id,
      { roleKey: role.key },
      now,
      activeGrant,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return {
    principalId: target.principal_id,
    roleKey: role.key,
    status: "granted" as const,
    userId: target.user_id,
  };
}

export async function revokeSystemRole(
  environment: AuthEnvironment,
  actor: Actor,
  identifier: string,
  roleKey: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "system-role-revoke", 120, 60);
  const db = createDb(environment.DB);
  const target = await resolveHumanPrincipal(db, identifier);
  if (!target) throw new ApiError(404);
  const role = await db
    .select({ id: systemRoles.id, key: systemRoles.key })
    .from(systemRoles)
    .where(eq(systemRoles.key, roleKey))
    .get();
  if (!role) throw new ApiError(404);
  const current = await db
    .select({ id: systemRoleGrants.id, revokedAt: systemRoleGrants.revokedAt })
    .from(systemRoleGrants)
    .where(
      and(
        eq(systemRoleGrants.principalId, target.principal_id),
        eq(systemRoleGrants.roleId, role.id),
      ),
    )
    .get();
  if (!current || current.revokedAt !== null) {
    return {
      principalId: target.principal_id,
      roleKey: role.key,
      status: "revoked" as const,
      userId: target.user_id,
    };
  }
  if (role.key === "root" && (await activeRootCount(db)) <= 1) throw new ApiError(409);

  const now = Date.now();
  const activeRoots = db
    .select({ count: sql<number>`count(*)` })
    .from(principals)
    .innerJoin(humanPrincipals, eq(humanPrincipals.principalId, principals.id))
    .innerJoin(systemRoleGrants, eq(systemRoleGrants.principalId, principals.id))
    .innerJoin(systemRoles, eq(systemRoles.id, systemRoleGrants.roleId))
    .where(
      and(
        eq(principals.type, "human"),
        eq(principals.status, "active"),
        eq(humanPrincipals.status, "active"),
        eq(humanPrincipals.disabled, false),
        isNull(systemRoleGrants.revokedAt),
        eq(systemRoles.key, "root"),
      ),
    );
  const canRevoke = role.key === "root" ? sql`(${activeRoots}) > 1` : sql`1 = 1`;
  const mutation = db
    .update(systemRoleGrants)
    .set({ revokedAt: now })
    .where(and(eq(systemRoleGrants.id, current.id), isNull(systemRoleGrants.revokedAt), canRevoke))
    .returning({ id: systemRoleGrants.id });
  const revokedGrant = db
    .select({ value: systemRoleGrants.id })
    .from(systemRoleGrants)
    .where(and(eq(systemRoleGrants.id, current.id), eq(systemRoleGrants.revokedAt, now)));
  const result = await db.batch([
    mutation,
    auditStatementWhen(
      db,
      `system-role:revoked:${target.principal_id}:${role.key}:${now}`,
      "system_role.revoked",
      actor.principalId,
      target.principal_id,
      target.user_id,
      { roleKey: role.key },
      now,
      revokedGrant,
    ),
    outboxStatementWhen(
      db,
      `system-role:revoked:outbox:${target.principal_id}:${role.key}:${now}`,
      "system_role.revoked",
      "principal",
      target.principal_id,
      { roleKey: role.key },
      now,
      revokedGrant,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return {
    principalId: target.principal_id,
    roleKey: role.key,
    status: "revoked" as const,
    userId: target.user_id,
  };
}
