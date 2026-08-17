import { and, eq, exists, isNull, not, or, sql } from "drizzle-orm";

import { createDb, type AppDb } from "../../../db";
import { session, user } from "../../../db/auth-schema";
import {
  humanPrincipals,
  principals,
  serviceAccounts,
  systemRoleGrants,
  systemRoles,
  teamMemberships,
  teams,
} from "../../../db/domain-schema";
import { type AuthEnvironment } from "../../auth";
import { type Actor } from "../authorization/service";
import { ApiError } from "../errors";
import { ensureHumanPrincipal } from "../identity/service";
import {
  auditStatement,
  auditStatementWhen,
  enforceRateLimit,
  outboxStatement,
  outboxStatementWhen,
} from "../../shared/infrastructure";

export async function resolveHumanPrincipal(database: AppDb, identifier: string) {
  const principal = await database
    .select({
      principalId: principals.id,
      principalStatus: principals.status,
      userId: humanPrincipals.userId,
      humanStatus: humanPrincipals.status,
      disabled: humanPrincipals.disabled,
    })
    .from(principals)
    .innerJoin(humanPrincipals, eq(humanPrincipals.principalId, principals.id))
    .where(or(eq(principals.id, identifier), eq(humanPrincipals.userId, identifier)))
    .get();
  if (!principal) return undefined;

  const rootGrant = await database
    .select({ id: systemRoleGrants.id })
    .from(systemRoleGrants)
    .innerJoin(systemRoles, eq(systemRoles.id, systemRoleGrants.roleId))
    .where(
      and(
        eq(systemRoleGrants.principalId, principal.principalId),
        isNull(systemRoleGrants.revokedAt),
        eq(systemRoles.key, "root"),
      ),
    )
    .get();

  return {
    principal_id: principal.principalId,
    principal_status: principal.principalStatus,
    user_id: principal.userId,
    human_status: principal.humanStatus,
    disabled: principal.disabled ? 1 : 0,
    is_root: rootGrant ? 1 : 0,
  };
}

export async function activeRootCount(database: AppDb) {
  const row = await database
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
    )
    .get();
  return row?.count ?? 0;
}

export async function listUsers(database: AppDb) {
  const rows = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      principalId: humanPrincipals.principalId,
      principalStatus: principals.status,
      humanStatus: humanPrincipals.status,
      disabled: humanPrincipals.disabled,
    })
    .from(user)
    .leftJoin(humanPrincipals, eq(humanPrincipals.userId, user.id))
    .leftJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .all();

  const roleRows = await database
    .select({ userId: humanPrincipals.userId, key: systemRoles.key })
    .from(humanPrincipals)
    .innerJoin(systemRoleGrants, eq(systemRoleGrants.principalId, humanPrincipals.principalId))
    .innerJoin(systemRoles, eq(systemRoles.id, systemRoleGrants.roleId))
    .where(isNull(systemRoleGrants.revokedAt))
    .all();
  const teamRows = await database
    .select({
      userId: humanPrincipals.userId,
      id: teams.id,
      name: teams.name,
      status: teams.status,
    })
    .from(teamMemberships)
    .innerJoin(humanPrincipals, eq(humanPrincipals.principalId, teamMemberships.userPrincipalId))
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .all();

  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows) {
    const roles = rolesByUser.get(row.userId) ?? [];
    roles.push(row.key);
    rolesByUser.set(row.userId, roles);
  }
  const teamsByUser = new Map<
    string,
    Array<{ id: string; name: string; status: "active" | "disabled" }>
  >();
  for (const row of teamRows) {
    const memberships = teamsByUser.get(row.userId) ?? [];
    memberships.push({ id: row.id, name: row.name, status: row.status });
    teamsByUser.set(row.userId, memberships);
  }

  return rows.map((row) => ({
    id: row.id,
    principalId: row.principalId ?? null,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    status: row.principalStatus ?? ("unmanaged" as const),
    humanStatus: row.humanStatus ?? null,
    disabled: row.disabled ?? false,
    roles: rolesByUser.get(row.id) ?? [],
    teams: teamsByUser.get(row.id) ?? [],
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
  }));
}

export async function repairHumanPrincipal(
  environment: AuthEnvironment,
  actor: Actor,
  identifier: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "human-principal-repair", 60, 60);
  const db = createDb(environment.DB);
  const target = await db
    .select({
      userId: user.id,
      principalId: humanPrincipals.principalId,
      principalStatus: principals.status,
      humanStatus: humanPrincipals.status,
      disabled: humanPrincipals.disabled,
    })
    .from(user)
    .leftJoin(humanPrincipals, eq(humanPrincipals.userId, user.id))
    .leftJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .where(or(eq(user.id, identifier), eq(humanPrincipals.principalId, identifier)))
    .get();
  if (!target) throw new ApiError(404);
  if (
    target.principalId &&
    target.principalStatus === "active" &&
    target.humanStatus === "active" &&
    target.disabled === false
  ) {
    return { principalId: target.principalId, status: "active" as const, userId: target.userId };
  }

  const now = Date.now();
  const principalId = await ensureHumanPrincipal(db, target.userId, now);
  await db.batch([
    auditStatement(
      db,
      `human-principal:repaired:${principalId}:${now}`,
      "human_principal.repaired",
      actor.principalId,
      principalId,
      target.userId,
      {},
      now,
    ),
    outboxStatement(
      db,
      `human-principal:repaired:outbox:${principalId}:${now}`,
      "human_principal.repaired",
      "principal",
      principalId,
      { userId: target.userId },
      now,
    ),
  ]);
  return { principalId, status: "repaired" as const, userId: target.userId };
}

export async function setUserDisabled(
  environment: AuthEnvironment,
  actor: Actor,
  identifier: string,
  disabled: boolean,
  request: Request,
) {
  await enforceRateLimit(environment, request, disabled ? "user-disable" : "user-enable", 60, 60);
  const db = createDb(environment.DB);
  const target = await resolveHumanPrincipal(db, identifier);
  if (!target) throw new ApiError(404);
  if (
    target.principal_status === (disabled ? "disabled" : "active") &&
    target.human_status === (disabled ? "disabled" : "active")
  ) {
    if (disabled) {
      await db.delete(session).where(eq(session.userId, target.user_id)).run();
    }
    return {
      status: disabled ? ("disabled" as const) : ("active" as const),
      userId: target.user_id,
    };
  }
  if (disabled) {
    const ownedServiceAccount = await db
      .select({ id: serviceAccounts.principalId })
      .from(serviceAccounts)
      .where(eq(serviceAccounts.ownerUserPrincipalId, target.principal_id))
      .get();
    if (ownedServiceAccount) throw new ApiError(409);
  }
  if (disabled && target.is_root === 1 && (await activeRootCount(db)) <= 1) {
    throw new ApiError(409);
  }

  const now = Date.now();
  const nextStatus = disabled ? "disabled" : "active";
  const ownRootGrant = db
    .select({ value: sql<number>`1` })
    .from(systemRoleGrants)
    .innerJoin(systemRoles, eq(systemRoles.id, systemRoleGrants.roleId))
    .where(
      and(
        eq(systemRoleGrants.principalId, principals.id),
        isNull(systemRoleGrants.revokedAt),
        eq(systemRoles.key, "root"),
      ),
    );
  const rootCount = db
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
  const mutation = disabled
    ? db
        .update(principals)
        .set({ status: "disabled", disabledAt: now, updatedAt: now })
        .where(
          and(
            eq(principals.id, target.principal_id),
            eq(principals.type, "human"),
            eq(principals.status, "active"),
            or(not(exists(ownRootGrant)), sql`(${rootCount}) > 1`),
          ),
        )
        .returning({ id: principals.id })
    : db
        .update(principals)
        .set({ status: "active", disabledAt: null, updatedAt: now })
        .where(
          and(
            eq(principals.id, target.principal_id),
            eq(principals.type, "human"),
            eq(principals.status, "disabled"),
          ),
        )
        .returning({ id: principals.id });
  const updatedPrincipal = db
    .select({ value: sql<number>`1` })
    .from(principals)
    .where(
      and(
        eq(principals.id, target.principal_id),
        eq(principals.status, nextStatus),
        eq(principals.updatedAt, now),
      ),
    );

  const results = await db.batch([
    mutation,
    db
      .update(humanPrincipals)
      .set({
        status: nextStatus,
        disabled,
        disabledAt: disabled ? now : null,
        updatedAt: now,
      })
      .where(and(eq(humanPrincipals.principalId, target.principal_id), exists(updatedPrincipal))),
    ...(disabled ? [db.delete(session).where(eq(session.userId, target.user_id))] : []),
    auditStatementWhen(
      db,
      `user:${disabled ? "disabled" : "enabled"}:${target.principal_id}:${now}`,
      `user.${disabled ? "disabled" : "enabled"}`,
      actor.principalId,
      target.principal_id,
      target.user_id,
      {},
      now,
      updatedPrincipal,
    ),
    outboxStatementWhen(
      db,
      `user:${disabled ? "disabled" : "enabled"}:outbox:${target.principal_id}:${now}`,
      `user.${disabled ? "disabled" : "enabled"}`,
      "principal",
      target.principal_id,
      { userId: target.user_id, status: nextStatus },
      now,
      updatedPrincipal,
    ),
  ]);

  if (!results[0]?.length) {
    const current = await resolveHumanPrincipal(db, identifier);
    if (current?.principal_status === nextStatus && current.human_status === nextStatus) {
      return {
        status: disabled ? ("disabled" as const) : ("active" as const),
        userId: current.user_id,
      };
    }
    throw new ApiError(409);
  }

  return { status: disabled ? ("disabled" as const) : ("active" as const), userId: target.user_id };
}
