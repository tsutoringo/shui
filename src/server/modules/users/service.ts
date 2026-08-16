import { and, eq, exists, isNull, not, or, sql } from "drizzle-orm";

import { createDb, type AppDb } from "../../../db";
import { session } from "../../../db/auth-schema";
import {
  humanPrincipals,
  principals,
  systemRoleGrants,
  systemRoles,
} from "../../../db/domain-schema";
import { type AuthEnvironment } from "../../auth";
import { type Actor } from "../authorization/service";
import { M1Error } from "../errors";
import {
  auditStatementWhen,
  enforceRateLimit,
  outboxStatementWhen,
} from "../../shared/infrastructure";

async function resolveHumanPrincipal(database: AppDb, identifier: string) {
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

async function activeRootCount(database: AppDb) {
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
  if (!target) throw new M1Error(404);
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
  if (disabled && target.is_root === 1 && (await activeRootCount(db)) <= 1) {
    throw new M1Error(409);
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
    throw new M1Error(409);
  }

  return { status: disabled ? ("disabled" as const) : ("active" as const), userId: target.user_id };
}
