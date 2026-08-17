import { and, eq, exists, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { createDb, type AppDb } from "../../../db";
import { session, user } from "../../../db/auth-schema";
import {
  humanPrincipals,
  invitations,
  outboxEvents,
  principals,
  systemRoleGrants,
  systemRoles,
} from "../../../db/domain-schema";
import { type AuthEnvironment, type AuthInstance, deliverEmail } from "../../auth";
import { type Actor } from "../authorization/service";
import { ensureControlledUser, ensureHumanPrincipal, readHumanMapping } from "../identity/service";
import { ApiError } from "../errors";
import { type InvitationAcceptBody, type InvitationCreateBody } from "../models";
import {
  auditStatement,
  auditStatementWhen,
  enforceRateLimit,
  normalizeEmail,
  normalizeName,
  outboxStatement,
  outboxStatementWhen,
  randomToken,
  sha256Base64Url,
  type Invitation,
} from "../../shared/infrastructure";

function toInvitation(row: typeof invitations.$inferSelect): Invitation {
  return {
    id: row.id,
    token_hash: row.tokenHash,
    email: row.email,
    name: row.name,
    status: row.status,
    expires_at: row.expiresAt,
    invited_by_principal_id: row.invitedByPrincipalId,
    claimed_user_id: row.claimedUserId,
    claimed_principal_id: row.claimedPrincipalId,
    system_role_keys: row.systemRoleKeys,
    claimed_at: row.claimedAt,
  };
}

async function readInvitation(database: AppDb, tokenHash: string) {
  const row = await database
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .get();

  return row ? toInvitation(row) : undefined;
}

async function expireInvitation(database: AppDb, invitation: Pick<Invitation, "id">, now: number) {
  const expiredInvitation = database
    .select({ value: sql<number>`1` })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitation.id),
        eq(invitations.status, "expired"),
        eq(invitations.expiredAt, now),
      ),
    );
  const expiredPrincipalId = sql<string>`(
    SELECT coalesce(
      ${invitations.claimedPrincipalId},
      'human_' || ${invitations.claimedUserId}
    )
    FROM ${invitations}
    WHERE ${invitations.id} = ${invitation.id}
      AND ${invitations.status} = 'expired'
      AND ${invitations.claimedUserId} IS NOT NULL
      AND ${invitations.expiredAt} = ${now}
  )`;
  const expiredUserId = sql<string>`(
    SELECT ${invitations.claimedUserId}
    FROM ${invitations}
    WHERE ${invitations.id} = ${invitation.id}
      AND ${invitations.status} = 'expired'
      AND ${invitations.claimedUserId} IS NOT NULL
      AND ${invitations.expiredAt} = ${now}
  )`;
  const expiredSubjectPrincipal = sql<string | null>`(
    SELECT ${principals.id}
    FROM ${principals}
    WHERE ${principals.id} = ${expiredPrincipalId}
  )`;
  await database.batch([
    database
      .update(invitations)
      .set({ status: "expired", expiredAt: now, updatedAt: now })
      .where(
        and(
          eq(invitations.id, invitation.id),
          isNull(invitations.expiredAt),
          or(
            and(
              inArray(invitations.status, ["pending", "claimed"]),
              lte(invitations.expiresAt, now),
            ),
            eq(invitations.status, "expired"),
          ),
        ),
      ),
    database
      .update(humanPrincipals)
      .set({ status: "disabled", disabled: true, disabledAt: now, updatedAt: now })
      .where(eq(humanPrincipals.principalId, expiredPrincipalId)),
    database
      .update(principals)
      .set({ status: "disabled", disabledAt: now, updatedAt: now })
      .where(and(eq(principals.id, expiredPrincipalId), eq(principals.status, "active"))),
    database.delete(session).where(eq(session.userId, expiredUserId)),
    auditStatementWhen(
      database,
      `invitation:expired:${invitation.id}`,
      "invitation.expired",
      null,
      expiredSubjectPrincipal,
      expiredUserId,
      { invitationId: invitation.id },
      now,
      expiredInvitation,
    ),
    outboxStatementWhen(
      database,
      `invitation:expired:${invitation.id}`,
      "invitation.expired",
      "invitation",
      invitation.id,
      { invitationId: invitation.id },
      now,
      expiredInvitation,
    ),
  ]);
}

export async function expireStaleInvitations(database: D1Database) {
  const db = createDb(database);
  const now = Date.now();
  const invitationsToExpire = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      or(
        and(inArray(invitations.status, ["pending", "claimed"]), lte(invitations.expiresAt, now)),
        and(eq(invitations.status, "expired"), isNull(invitations.expiredAt)),
      ),
    )
    .all();

  for (const invitation of invitationsToExpire) {
    await expireInvitation(db, invitation, now);
  }
}

async function sendInvitationEmail(
  environment: AuthEnvironment,
  invitation: { email: string; token: string; expiresAt: number; name: string | null },
) {
  const url = `${environment.BETTER_AUTH_URL}/invite/${encodeURIComponent(invitation.token)}`;
  await deliverEmail(environment, {
    email: invitation.email,
    kind: "invitation",
    token: invitation.token,
    url,
  });
}

function roleKeysFromStorage(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ApiError(500);
  }
  if (!Array.isArray(parsed) || !parsed.every((key) => typeof key === "string")) {
    throw new ApiError(500);
  }
  return [...new Set(parsed)];
}

async function validateRoleKeys(database: AppDb, requested: readonly string[]) {
  const unique = [...new Set(requested)];
  if (unique.length > 3) throw new ApiError(400);
  if (unique.length === 0) return unique;

  const roles = await database
    .select({ key: systemRoles.key })
    .from(systemRoles)
    .where(inArray(systemRoles.key, unique))
    .all();
  if (roles.length !== unique.length) throw new ApiError(400);

  return unique;
}

function grantInvitationRoleStatement(
  database: AppDb,
  invitationId: string,
  userId: string,
  principalId: string,
  roleKey: string,
  grantedByPrincipalId: string | null,
  now: number,
) {
  const completedInvitation = database
    .select({ value: sql<number>`1` })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.status, "completed"),
        eq(invitations.claimedUserId, userId),
      ),
    );
  return database
    .insert(systemRoleGrants)
    .select(
      database
        .select({
          id: sql<string>`${`system-role:${principalId}:${roleKey}`}`.as("id"),
          principalId: sql<string>`${principalId}`.as("principal_id"),
          roleId: systemRoles.id,
          grantedByPrincipalId: sql<string | null>`${grantedByPrincipalId}`.as(
            "granted_by_principal_id",
          ),
          revokedAt: sql<number | null>`NULL`.as("revoked_at"),
          createdAt: sql<number>`${now}`.as("created_at"),
        })
        .from(systemRoles)
        .where(and(eq(systemRoles.key, roleKey), exists(completedInvitation))),
    )
    .onConflictDoUpdate({
      target: [systemRoleGrants.principalId, systemRoleGrants.roleId],
      set: { revokedAt: null },
    });
}

export async function createInvitation(
  environment: AuthEnvironment,
  actor: Actor,
  body: InvitationCreateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "invitation-create", 30, 60);
  const database = createDb(environment.DB);
  const email = normalizeEmail(body.email);
  const name = body.name ? normalizeName(body.name, email) : null;
  const requestedRoleKeys = await validateRoleKeys(database, body.systemRoleKeys ?? []);
  const now = Date.now();
  const staleInvitations = await database
    .select({ expiresAt: invitations.expiresAt, id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        inArray(invitations.status, ["pending", "claimed"]),
        lte(invitations.expiresAt, now),
      ),
    )
    .all();
  for (const staleInvitation of staleInvitations) {
    await expireInvitation(database, staleInvitation, now);
  }
  const existingMapping = await database
    .select({ userId: humanPrincipals.userId })
    .from(humanPrincipals)
    .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .innerJoin(user, eq(user.id, humanPrincipals.userId))
    .where(
      and(
        eq(user.email, email),
        eq(principals.status, "active"),
        eq(humanPrincipals.status, "active"),
        eq(humanPrincipals.disabled, false),
      ),
    )
    .get();
  if (existingMapping) throw new ApiError(409);
  const existingInvitation = await database
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.email, email), inArray(invitations.status, ["pending", "claimed"])))
    .get();
  if (existingInvitation) throw new ApiError(409);

  const token = randomToken();
  const tokenHash = await sha256Base64Url(token);
  const invitationId = crypto.randomUUID();
  const requestedLifetime = body.expiresInSeconds ?? body.expiresIn ?? 60 * 60 * 24 * 7;
  const expiresAt = now + requestedLifetime * 1000;

  try {
    await database.batch([
      database.insert(invitations).values({
        id: invitationId,
        tokenHash,
        email,
        name,
        status: "pending",
        expiresAt,
        invitedByPrincipalId: actor.principalId,
        systemRoleKeys: JSON.stringify(requestedRoleKeys),
        createdAt: now,
        updatedAt: now,
      }),
      auditStatement(
        database,
        `invitation:created:${invitationId}`,
        "invitation.created",
        actor.principalId,
        null,
        null,
        { email, expiresAt },
        now,
      ),
      outboxStatement(
        database,
        `invitation:created:outbox:${invitationId}`,
        "invitation.created",
        "invitation",
        invitationId,
        { email, expiresAt },
        now,
      ),
    ]);
  } catch (error) {
    const conflictingInvitation = await database
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.email, email), inArray(invitations.status, ["pending", "claimed"])))
      .get();
    if (conflictingInvitation) throw new ApiError(409);
    throw error;
  }

  let deliveryPending = false;
  try {
    await sendInvitationEmail(environment, { email, expiresAt, name, token });
  } catch (error) {
    deliveryPending = true;
    await database
      .update(outboxEvents)
      .set({
        status: "failed",
        attempts: sql<number>`${outboxEvents.attempts} + 1`,
        lastError: error instanceof Error ? error.message : "Invitation delivery failed.",
        availableAt: Date.now(),
      })
      .where(eq(outboxEvents.dedupeKey, `invitation:created:outbox:${invitationId}`))
      .run();
  }
  return { deliveryPending, email, expiresAt, id: invitationId, token };
}

export async function getPublicInvitation(
  environment: AuthEnvironment,
  token: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "invitation-read", 60, 60);
  const database = createDb(environment.DB);
  const invitation = await readInvitation(database, await sha256Base64Url(token));
  if (!invitation) throw new ApiError(404);
  const now = Date.now();
  if (
    (invitation.status === "pending" || invitation.status === "claimed") &&
    invitation.expires_at <= now
  ) {
    await expireInvitation(database, invitation, now);
    throw new ApiError(404);
  }
  if (invitation.status === "expired") {
    await expireInvitation(database, invitation, now);
    throw new ApiError(404);
  }
  if (invitation.status !== "pending" && invitation.status !== "claimed") throw new ApiError(404);
  return {
    email: invitation.email,
    expiresAt: invitation.expires_at,
    name: invitation.name,
    status: invitation.status,
  };
}

export async function claimInvitationWithAuth(
  environment: AuthEnvironment,
  auth: AuthInstance,
  token: string,
  body: InvitationAcceptBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "invitation-accept", 30, 60);
  const database = createDb(environment.DB);
  const invitation = await readInvitation(database, await sha256Base64Url(token));
  if (!invitation) throw new ApiError(404);
  const now = Date.now();
  const suppliedEmail = body.email ? normalizeEmail(body.email) : invitation.email;
  if (suppliedEmail !== invitation.email) throw new ApiError(400);
  const context = await auth.$context;
  if (
    body.password.length < context.password.config.minPasswordLength ||
    body.password.length > context.password.config.maxPasswordLength
  ) {
    throw new ApiError(400);
  }

  let current = invitation;
  if (current.status === "pending") {
    if (current.expires_at <= now) {
      await expireInvitation(database, current, now);
      throw new ApiError(404);
    }
    const claimed = await database
      .update(invitations)
      .set({ status: "claimed", claimedAt: now, updatedAt: now })
      .where(
        and(
          eq(invitations.id, current.id),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, now),
        ),
      )
      .returning()
      .get();
    current = claimed
      ? toInvitation(claimed)
      : ((await readInvitation(database, current.token_hash)) ?? current);
  }
  if (current.status === "pending" || current.status === "revoked") {
    throw new ApiError(409);
  }
  if (current.status === "expired") {
    await expireInvitation(database, current, now);
    throw new ApiError(409);
  }
  if (current.expires_at <= now) {
    await expireInvitation(database, current, now);
    throw new ApiError(409);
  }
  if (current.status === "completed") throw new ApiError(409);

  const existingUser = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, current.email))
    .get();
  const existingMapping = existingUser
    ? await readHumanMapping(database, existingUser.id)
    : undefined;
  const hasActiveMapping =
    existingMapping?.principal_status === "active" &&
    existingMapping.human_status === "active" &&
    existingMapping.disabled === 0;
  const managedUser = await ensureControlledUser(
    auth,
    current.email,
    normalizeName(body.name, current.name ?? current.email),
    body.password,
    current.claimed_user_id,
    Boolean(current.claimed_user_id) || !hasActiveMapping,
    current.claimed_at,
  );
  const marked = await database
    .update(invitations)
    .set({ claimedUserId: managedUser.id, updatedAt: Date.now() })
    .where(
      and(
        eq(invitations.id, current.id),
        eq(invitations.status, "claimed"),
        or(isNull(invitations.claimedUserId), eq(invitations.claimedUserId, managedUser.id)),
      ),
    )
    .returning({ claimedUserId: invitations.claimedUserId })
    .get();
  if (!marked) {
    const racedInvitation = await readInvitation(database, current.token_hash);
    if (!racedInvitation || racedInvitation.claimed_user_id !== managedUser.id)
      throw new ApiError(409);
    current = racedInvitation;
  } else {
    current = (await readInvitation(database, current.token_hash)) ?? current;
  }
  if (current.status !== "claimed") throw new ApiError(409);

  const roleKeys = await validateRoleKeys(database, roleKeysFromStorage(current.system_role_keys));
  const principalId = await ensureHumanPrincipal(
    database,
    managedUser.id,
    Date.now(),
    true,
    current.id,
    (database, invitationId, expirationNow) =>
      expireInvitation(database, { id: invitationId }, expirationNow),
  );
  const eventId = `invitation:completed:${current.id}`;
  const completedAt = Date.now();
  const completedInvitation = database
    .select({ value: sql<number>`1` })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, current.id),
        eq(invitations.status, "completed"),
        eq(invitations.claimedUserId, managedUser.id),
      ),
    );
  const completionMutation = database
    .update(invitations)
    .set({
      status: "completed",
      claimedPrincipalId: principalId,
      completedAt,
      updatedAt: completedAt,
    })
    .where(
      and(
        eq(invitations.id, current.id),
        eq(invitations.status, "claimed"),
        eq(invitations.claimedUserId, managedUser.id),
        gt(invitations.expiresAt, completedAt),
      ),
    )
    .returning({ id: invitations.id });
  const roleStatements = roleKeys.map((roleKey) =>
    grantInvitationRoleStatement(
      database,
      current.id,
      managedUser.id,
      principalId,
      roleKey,
      current.invited_by_principal_id,
      completedAt,
    ),
  );
  const auditQuery = auditStatementWhen(
    database,
    eventId,
    "invitation.completed",
    current.invited_by_principal_id,
    principalId,
    managedUser.id,
    { email: current.email },
    completedAt,
    completedInvitation,
  );
  const outboxQuery = outboxStatementWhen(
    database,
    `invitation:completed:outbox:${current.id}`,
    "invitation.completed",
    "invitation",
    current.id,
    { principalId, userId: managedUser.id },
    completedAt,
    completedInvitation,
  );
  const statements: [
    typeof completionMutation,
    ...typeof roleStatements,
    typeof auditQuery,
    typeof outboxQuery,
  ] = [completionMutation, ...roleStatements, auditQuery, outboxQuery];
  const results = await database.batch(statements);
  const completionResult = results[0];
  if (!Array.isArray(completionResult) || !completionResult.length) {
    await expireInvitation(database, current, completedAt);
    throw new ApiError(409);
  }
  return {
    email: managedUser.email,
    principalId,
    status: "accepted" as const,
    userId: managedUser.id,
  };
}

async function resolveInvitationForRevoke(database: AppDb, identifier: string) {
  const byId = await database
    .select({ id: invitations.id, status: invitations.status })
    .from(invitations)
    .where(eq(invitations.id, identifier))
    .get();
  if (byId) return byId;
  const tokenHash = await sha256Base64Url(identifier);
  return database
    .select({ id: invitations.id, status: invitations.status })
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .get();
}

export async function revokeInvitation(
  environment: AuthEnvironment,
  actor: Actor,
  identifier: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "invitation-revoke", 30, 60);
  const database = createDb(environment.DB);
  const invitation = await resolveInvitationForRevoke(database, identifier);
  if (!invitation) throw new ApiError(404);
  const now = Date.now();
  const revokedInvitation = database
    .select({ value: sql<number>`1` })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitation.id),
        eq(invitations.status, "revoked"),
        eq(invitations.revokedAt, now),
      ),
    );
  const revokedPrincipalId = sql<string>`(
    SELECT coalesce(
      ${invitations.claimedPrincipalId},
      'human_' || ${invitations.claimedUserId}
    )
    FROM ${invitations}
    WHERE ${invitations.id} = ${invitation.id}
      AND ${invitations.status} = 'revoked'
      AND ${invitations.revokedAt} = ${now}
      AND ${invitations.claimedUserId} IS NOT NULL
  )`;
  const revokedUserId = sql<string>`(
    SELECT ${invitations.claimedUserId}
    FROM ${invitations}
    WHERE ${invitations.id} = ${invitation.id}
      AND ${invitations.status} = 'revoked'
      AND ${invitations.revokedAt} = ${now}
      AND ${invitations.claimedUserId} IS NOT NULL
  )`;
  const results = await database.batch([
    database
      .update(invitations)
      .set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(invitations.id, invitation.id),
          isNull(invitations.revokedAt),
          inArray(invitations.status, ["pending", "claimed", "revoked"]),
        ),
      )
      .returning({ id: invitations.id }),
    database
      .update(humanPrincipals)
      .set({ status: "disabled", disabled: true, disabledAt: now, updatedAt: now })
      .where(eq(humanPrincipals.principalId, revokedPrincipalId)),
    database
      .update(principals)
      .set({ status: "disabled", disabledAt: now, updatedAt: now })
      .where(and(eq(principals.id, revokedPrincipalId), eq(principals.status, "active"))),
    database.delete(session).where(eq(session.userId, revokedUserId)),
    auditStatementWhen(
      database,
      `invitation:revoked:${invitation.id}`,
      "invitation.revoked",
      actor.principalId,
      null,
      null,
      { invitationId: invitation.id },
      now,
      revokedInvitation,
    ),
    outboxStatementWhen(
      database,
      `invitation:revoked:outbox:${invitation.id}`,
      "invitation.revoked",
      "invitation",
      invitation.id,
      {},
      now,
      revokedInvitation,
    ),
  ]);
  if (!results[0]?.length) {
    const current = await resolveInvitationForRevoke(database, identifier);
    if (current?.status !== "revoked") throw new ApiError(409);
  }
  return { id: invitation.id, status: "revoked" as const };
}
