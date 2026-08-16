import { and, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";

import { createDb, type AppDb } from "../../../db";
import {
  bootstrapState,
  humanPrincipals,
  principals,
  systemRoleGrants,
  systemRoles,
} from "../../../db/domain-schema";
import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { M1Error } from "../errors";
import { type BootstrapCompleteBody, type BootstrapTokenBody } from "../models";
import {
  ensureControlledUser,
  ensureHumanPrincipal,
  sendVerificationEmail,
} from "../identity/service";
import {
  auditStatementWhen,
  enforceRateLimit,
  normalizeEmail,
  normalizeName,
  outboxStatementWhen,
  type BootstrapState,
  validateBootstrapToken,
} from "../../shared/infrastructure";

async function getBootstrapState(database: AppDb) {
  const row = await database.select().from(bootstrapState).where(eq(bootstrapState.id, 1)).get();

  if (!row) throw new M1Error(500);
  return {
    status: row.status,
    reservation_id: row.reservationId,
    email: row.email,
    user_id: row.userId,
    principal_id: row.principalId,
    reserved_at: row.reservedAt,
  } satisfies BootstrapState;
}

function tokenFromBody(body: BootstrapTokenBody) {
  const token = body.bootstrapToken ?? body.token;
  if (!token) throw new M1Error(403);
  return token;
}

async function requireBootstrapToken(environment: AuthEnvironment, body: BootstrapTokenBody) {
  const token = tokenFromBody(body);
  if (!(await validateBootstrapToken(environment, token))) throw new M1Error(403);
  return token;
}

function grantBootstrapRoleStatement(
  database: AppDb,
  reservationId: string,
  userId: string,
  principalId: string,
  now: number,
) {
  return database
    .insert(systemRoleGrants)
    .select(
      database
        .select({
          id: sql<string>`${`system-role:${principalId}:root`}`.as("id"),
          principalId: sql<string>`${principalId}`.as("principal_id"),
          roleId: systemRoles.id,
          grantedByPrincipalId: sql<string | null>`NULL`.as("granted_by_principal_id"),
          revokedAt: sql<number | null>`NULL`.as("revoked_at"),
          createdAt: sql<number>`${now}`.as("created_at"),
        })
        .from(systemRoles)
        .where(
          and(
            eq(systemRoles.key, "root"),
            exists(
              database
                .select({ value: sql<number>`1` })
                .from(bootstrapState)
                .where(
                  and(
                    eq(bootstrapState.id, 1),
                    eq(bootstrapState.status, "completed"),
                    eq(bootstrapState.reservationId, reservationId),
                    eq(bootstrapState.userId, userId),
                  ),
                ),
            ),
          ),
        ),
    )
    .onConflictDoUpdate({
      target: [systemRoleGrants.principalId, systemRoleGrants.roleId],
      set: { revokedAt: null },
    });
}

async function completeBootstrapDomain(
  database: AppDb,
  state: BootstrapState,
  user: { id: string; email: string },
  principalId: string,
  now: number,
) {
  const existingRoot = await database
    .select({ principalId: systemRoleGrants.principalId })
    .from(systemRoleGrants)
    .innerJoin(systemRoles, eq(systemRoles.id, systemRoleGrants.roleId))
    .innerJoin(principals, eq(principals.id, systemRoleGrants.principalId))
    .innerJoin(humanPrincipals, eq(humanPrincipals.principalId, principals.id))
    .where(
      and(
        eq(systemRoles.key, "root"),
        isNull(systemRoleGrants.revokedAt),
        eq(principals.type, "human"),
        eq(principals.status, "active"),
        eq(humanPrincipals.status, "active"),
        eq(humanPrincipals.disabled, false),
      ),
    )
    .get();
  if (existingRoot && existingRoot.principalId !== principalId) throw new M1Error(409);

  const reservationId = state.reservation_id ?? "";
  const email = state.email ?? normalizeEmail(user.email);
  const eventId = `bootstrap:completed:${state.reservation_id ?? principalId}`;
  const completedState = database
    .select({ value: sql<number>`1` })
    .from(bootstrapState)
    .where(
      and(
        eq(bootstrapState.id, 1),
        eq(bootstrapState.status, "completed"),
        eq(bootstrapState.reservationId, reservationId),
        eq(bootstrapState.userId, user.id),
      ),
    );
  const results = await database.batch([
    database
      .update(bootstrapState)
      .set({
        status: "completed",
        principalId,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(bootstrapState.id, 1),
          inArray(bootstrapState.status, ["reserved", "user-created"]),
          eq(bootstrapState.reservationId, reservationId),
          eq(bootstrapState.email, email),
          eq(bootstrapState.userId, user.id),
        ),
      )
      .returning({ id: bootstrapState.id }),
    grantBootstrapRoleStatement(database, reservationId, user.id, principalId, now),
    auditStatementWhen(
      database,
      eventId,
      "bootstrap.completed",
      null,
      principalId,
      user.id,
      { email },
      now,
      completedState,
    ),
    outboxStatementWhen(
      database,
      `bootstrap:completed:outbox:${state.reservation_id ?? principalId}`,
      "bootstrap.completed",
      "bootstrap",
      "1",
      { principalId, userId: user.id },
      now,
      completedState,
    ),
  ]);
  if (!results[0]?.length) throw new M1Error(409);
}

export async function reserveBootstrap(
  environment: AuthEnvironment,
  body: BootstrapTokenBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "bootstrap-reserve", 50, 60);
  await requireBootstrapToken(environment, body);
  const database = createDb(environment.DB);
  const state = await getBootstrapState(database);
  if (state.status === "completed") throw new M1Error(404);
  if (state.status !== "uninitialized") {
    if (!state.reservation_id) throw new M1Error(500);
    return { reservationId: state.reservation_id, status: state.status };
  }

  const reservationId = crypto.randomUUID();
  const now = Date.now();
  const reservedState = database
    .select({ value: sql<number>`1` })
    .from(bootstrapState)
    .where(
      and(
        eq(bootstrapState.id, 1),
        eq(bootstrapState.status, "reserved"),
        eq(bootstrapState.reservationId, reservationId),
        eq(bootstrapState.reservedAt, now),
      ),
    );
  const results = await database.batch([
    database
      .update(bootstrapState)
      .set({ status: "reserved", reservationId, reservedAt: now, updatedAt: now })
      .where(and(eq(bootstrapState.id, 1), eq(bootstrapState.status, "uninitialized")))
      .returning({ reservationId: bootstrapState.reservationId, status: bootstrapState.status }),
    auditStatementWhen(
      database,
      `bootstrap:reserved:${reservationId}`,
      "bootstrap.reserved",
      null,
      null,
      null,
      {},
      now,
      reservedState,
    ),
    outboxStatementWhen(
      database,
      `bootstrap:reserved:outbox:${reservationId}`,
      "bootstrap.reserved",
      "bootstrap",
      "1",
      { reservationId },
      now,
      reservedState,
    ),
  ]);
  const reserved = results[0]?.[0];

  if (!reserved) {
    const racedState = await getBootstrapState(database);
    if (racedState.status === "completed" || !racedState.reservation_id) throw new M1Error(409);
    return { reservationId: racedState.reservation_id, status: racedState.status };
  }

  return { reservationId, status: reserved.status };
}

export async function completeBootstrap(
  environment: AuthEnvironment,
  auth: AuthInstance,
  body: BootstrapCompleteBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "bootstrap-complete", 50, 60);
  await requireBootstrapToken(environment, body);
  const database = createDb(environment.DB);
  const state = await getBootstrapState(database);
  if (state.status === "completed") {
    if (state.email && normalizeEmail(body.email) !== state.email) throw new M1Error(409);
    return { status: state.status, userId: state.user_id };
  }
  if (state.status === "uninitialized" || !state.reservation_id) throw new M1Error(409);
  if (body.reservationId && body.reservationId !== state.reservation_id) throw new M1Error(409);

  const email = normalizeEmail(body.email);
  if (state.email && state.email !== email) throw new M1Error(409);

  const context = await auth.$context;
  if (
    body.password.length < context.password.config.minPasswordLength ||
    body.password.length > context.password.config.maxPasswordLength
  ) {
    throw new M1Error(400);
  }

  if (!state.email) {
    const claimedEmail = await database
      .update(bootstrapState)
      .set({ email, updatedAt: Date.now() })
      .where(
        and(
          eq(bootstrapState.id, 1),
          eq(bootstrapState.status, "reserved"),
          eq(bootstrapState.reservationId, state.reservation_id),
          or(isNull(bootstrapState.email), eq(bootstrapState.email, email)),
        ),
      )
      .returning({ email: bootstrapState.email })
      .get();
    if (!claimedEmail) {
      const racedState = await getBootstrapState(database);
      if (racedState.email !== email) throw new M1Error(409);
    }
  }

  const user = await ensureControlledUser(
    auth,
    email,
    normalizeName(body.name, email),
    body.password,
    state.user_id,
    false,
    state.reserved_at,
  );
  const userCreatedAt = Date.now();
  const marked = await database
    .update(bootstrapState)
    .set({
      status: "user-created",
      userId: user.id,
      userCreatedAt: sql<number>`coalesce(${bootstrapState.userCreatedAt}, ${userCreatedAt})`,
      updatedAt: userCreatedAt,
    })
    .where(
      and(
        eq(bootstrapState.id, 1),
        inArray(bootstrapState.status, ["reserved", "user-created"]),
        eq(bootstrapState.reservationId, state.reservation_id),
        eq(bootstrapState.email, email),
        or(isNull(bootstrapState.userId), eq(bootstrapState.userId, user.id)),
      ),
    )
    .returning({ userId: bootstrapState.userId })
    .get();
  if (!marked) {
    const racedState = await getBootstrapState(database);
    if (racedState.user_id !== user.id) throw new M1Error(409);
  }

  const markedState = await getBootstrapState(database);
  await sendVerificationEmail(auth, user);
  const principalId = await ensureHumanPrincipal(database, user.id, Date.now());
  await completeBootstrapDomain(database, markedState, user, principalId, Date.now());

  return { principalId, status: "completed" as const, userId: user.id };
}

export async function completeSetup(
  environment: AuthEnvironment,
  auth: AuthInstance,
  body: BootstrapCompleteBody,
  request: Request,
) {
  const reservation = await reserveBootstrap(environment, body, request);
  return completeBootstrap(
    environment,
    auth,
    { ...body, reservationId: body.reservationId ?? reservation.reservationId },
    request,
  );
}

export async function getBootstrapStatus(environment: AuthEnvironment) {
  const state = await getBootstrapState(createDb(environment.DB));
  if (state.status === "completed") throw new M1Error(404);
  return { available: true as const, status: state.status };
}
