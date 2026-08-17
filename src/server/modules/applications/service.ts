import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { createDb, type AppDb } from "../../../db";
import { oauthClient, oauthClientResource, oauthResource, user } from "../../../db/auth-schema";
import {
  applicationOauthClients,
  applicationResources,
  applicationRoles,
  applications,
  humanPrincipals,
  principals,
  serviceAccountApplicationAssignments,
  serviceAccountApplicationRoleGrants,
  serviceAccounts,
  teamApplicationAssignments,
  teamApplicationRoleGrants,
  teamMemberships,
  teams,
  userApplicationAssignments,
  userApplicationRoleGrants,
} from "../../../db/domain-schema";
import { type AuthEnvironment } from "../../auth";
import { type Actor } from "../authorization/service";
import { ApiError } from "../errors";
import { resolveActiveOwner, type OwnershipInput } from "../ownership";
import {
  auditStatement,
  auditStatementWhen,
  enforceRateLimit,
  outboxStatement,
  outboxStatementWhen,
  randomToken,
  sha256Base64Url,
} from "../../shared/infrastructure";
import type {
  Application,
  ApplicationAssignmentBody,
  ApplicationClient,
  ApplicationClientCreateBody,
  ApplicationClientUpdateBody,
  ApplicationCreateBody,
  ApplicationRole,
  ApplicationRoleCreateBody,
  ApplicationRoleUpdateBody,
  ApplicationRoleGrantBody,
  ApplicationUpdateBody,
} from "../models";

const SUPPORTED_SCOPES = ["openid", "profile", "email", "api:read"] as const;
const ROLE_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/;
const SUBJECT_TYPES = ["user", "service-account", "team"] as const;

export type ApplicationSubjectType = (typeof SUBJECT_TYPES)[number];

type ApplicationRecord = Application;

type ResolvedSubject = {
  id: string;
  principalId: string | null;
  userId: string | null;
  type: ApplicationSubjectType;
  status: "active" | "disabled";
  name: string;
};

function timestamp(value: Date | number | null | undefined) {
  if (value instanceof Date) return value.getTime();
  return Number(value ?? 0);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeName(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > 160) throw new ApiError(400);
  return normalized;
}

function normalizeDescription(value: string | null | undefined) {
  if (value === undefined || value === null) return value ?? null;
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length > 1000) throw new ApiError(400);
  return normalized || null;
}

function normalizeRoleKey(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length > 64 || !ROLE_KEY_PATTERN.test(normalized)) throw new ApiError(400);
  return normalized;
}

function normalizeResourceIdentifier(
  value: string,
  environment: AuthEnvironment,
  applicationId: string,
) {
  const candidate =
    value || new URL(`/api/resources/${applicationId}`, environment.BETTER_AUTH_URL).toString();
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ApiError(400);
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new ApiError(400);
  }
  return parsed.toString();
}

function normalizeRedirectUris(values: string[]) {
  const normalized = values.map((value) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new ApiError(400);
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.hash) throw new ApiError(400);
    return parsed.toString();
  });
  if (normalized.length === 0 || new Set(normalized).size !== normalized.length)
    throw new ApiError(400);
  return normalized;
}

function normalizeScopes(values: string[]) {
  const scopes = Array.from(new Set(values.map((value) => value.trim())));
  if (!scopes.length || !scopes.includes("openid")) throw new ApiError(400);
  if (
    scopes.some((scope) => !SUPPORTED_SCOPES.includes(scope as (typeof SUPPORTED_SCOPES)[number]))
  ) {
    throw new ApiError(400);
  }
  return SUPPORTED_SCOPES.filter((scope) => scopes.includes(scope));
}

async function readOwner(
  database: AppDb,
  ownerUserPrincipalId: string | null,
  ownerTeamId: string | null,
) {
  if (ownerUserPrincipalId) {
    const owner = await database
      .select({ name: user.name, email: user.email })
      .from(user)
      .innerJoin(humanPrincipals, eq(humanPrincipals.userId, user.id))
      .where(eq(humanPrincipals.principalId, ownerUserPrincipalId))
      .get();
    return {
      id: ownerUserPrincipalId,
      label: owner?.name ?? owner?.email ?? ownerUserPrincipalId,
      type: "user" as const,
    };
  }
  if (ownerTeamId) {
    const owner = await database
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, ownerTeamId))
      .get();
    return { id: ownerTeamId, label: owner?.name ?? ownerTeamId, type: "team" as const };
  }
  throw new ApiError(500);
}

async function readApplicationRow(database: AppDb, applicationId: string) {
  const row = await database
    .select({
      id: applications.id,
      name: applications.name,
      description: applications.description,
      status: applications.status,
      disabledAt: applications.disabledAt,
      ownerUserPrincipalId: applications.ownerUserPrincipalId,
      ownerTeamId: applications.ownerTeamId,
      authzVersion: applications.authzVersion,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      resourceIdentifier: applicationResources.resourceIdentifier,
    })
    .from(applications)
    .innerJoin(applicationResources, eq(applicationResources.applicationId, applications.id))
    .where(eq(applications.id, applicationId))
    .get();
  if (!row) throw new ApiError(404);
  return row;
}

async function toApplication(database: AppDb, row: Awaited<ReturnType<typeof readApplicationRow>>) {
  const [roleCount, clientCount, userAssignmentCount, serviceAssignmentCount, teamAssignmentCount] =
    await Promise.all([
      database
        .select({ id: applicationRoles.id })
        .from(applicationRoles)
        .where(eq(applicationRoles.applicationId, row.id))
        .all(),
      database
        .select({ id: applicationOauthClients.clientId })
        .from(applicationOauthClients)
        .where(eq(applicationOauthClients.applicationId, row.id))
        .all(),
      database
        .select({ id: userApplicationAssignments.id })
        .from(userApplicationAssignments)
        .where(eq(userApplicationAssignments.applicationId, row.id))
        .all(),
      database
        .select({ id: serviceAccountApplicationAssignments.id })
        .from(serviceAccountApplicationAssignments)
        .where(eq(serviceAccountApplicationAssignments.applicationId, row.id))
        .all(),
      database
        .select({ id: teamApplicationAssignments.id })
        .from(teamApplicationAssignments)
        .where(eq(teamApplicationAssignments.applicationId, row.id))
        .all(),
    ]);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    resourceIdentifier: row.resourceIdentifier,
    owner: await readOwner(database, row.ownerUserPrincipalId, row.ownerTeamId),
    authzVersion: row.authzVersion,
    roleCount: roleCount.length,
    assignmentCount:
      userAssignmentCount.length + serviceAssignmentCount.length + teamAssignmentCount.length,
    clientCount: clientCount.length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } satisfies ApplicationRecord;
}

export function applicationAuthzVersionStatement(
  database: AppDb,
  applicationId: string,
  now = Date.now(),
) {
  return database
    .update(applications)
    .set({ authzVersion: sql`${applications.authzVersion} + 1`, updatedAt: now })
    .where(eq(applications.id, applicationId));
}

export function applicationsForTeamAuthzVersionStatement(
  database: AppDb,
  teamId: string,
  now = Date.now(),
) {
  const affected = database
    .select({ id: teamApplicationAssignments.applicationId })
    .from(teamApplicationAssignments)
    .where(eq(teamApplicationAssignments.teamId, teamId));
  return database
    .update(applications)
    .set({ authzVersion: sql`${applications.authzVersion} + 1`, updatedAt: now })
    .where(inArray(applications.id, affected));
}

export function applicationsForPrincipalAuthzVersionStatement(
  database: AppDb,
  principalId: string,
  now = Date.now(),
) {
  const userDirect = database
    .select({ id: userApplicationAssignments.applicationId })
    .from(userApplicationAssignments)
    .where(eq(userApplicationAssignments.userPrincipalId, principalId));
  const serviceDirect = database
    .select({ id: serviceAccountApplicationAssignments.applicationId })
    .from(serviceAccountApplicationAssignments)
    .where(eq(serviceAccountApplicationAssignments.serviceAccountPrincipalId, principalId));
  const team = database
    .select({ id: teamApplicationAssignments.applicationId })
    .from(teamApplicationAssignments)
    .innerJoin(teamMemberships, eq(teamMemberships.teamId, teamApplicationAssignments.teamId))
    .where(eq(teamMemberships.userPrincipalId, principalId));
  return database
    .update(applications)
    .set({ authzVersion: sql`${applications.authzVersion} + 1`, updatedAt: now })
    .where(
      or(
        inArray(applications.id, userDirect),
        inArray(applications.id, serviceDirect),
        inArray(applications.id, team),
      ),
    );
}

export async function listApplicationOwners(environment: AuthEnvironment) {
  const database = createDb(environment.DB);
  const [users, teamsRows] = await Promise.all([
    database
      .select({ id: humanPrincipals.principalId, name: user.name })
      .from(humanPrincipals)
      .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
      .innerJoin(user, eq(user.id, humanPrincipals.userId))
      .where(
        and(
          eq(principals.type, "human"),
          eq(principals.status, "active"),
          eq(humanPrincipals.status, "active"),
          eq(humanPrincipals.disabled, false),
        ),
      )
      .orderBy(asc(user.name))
      .all(),
    database
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.status, "active"))
      .orderBy(asc(teams.name))
      .all(),
  ]);
  return { users, teams: teamsRows };
}

export async function listApplications(environment: AuthEnvironment) {
  const database = createDb(environment.DB);
  const rows = await database
    .select({
      id: applications.id,
      name: applications.name,
      description: applications.description,
      status: applications.status,
      disabledAt: applications.disabledAt,
      ownerUserPrincipalId: applications.ownerUserPrincipalId,
      ownerTeamId: applications.ownerTeamId,
      authzVersion: applications.authzVersion,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      resourceIdentifier: applicationResources.resourceIdentifier,
    })
    .from(applications)
    .innerJoin(applicationResources, eq(applicationResources.applicationId, applications.id))
    .orderBy(asc(applications.name))
    .all();
  return Promise.all(rows.map((row) => toApplication(database, row)));
}

export async function createApplication(
  environment: AuthEnvironment,
  actor: Actor,
  body: ApplicationCreateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-create", 60, 60);
  const database = createDb(environment.DB);
  const name = normalizeName(body.name);
  const description = normalizeDescription(body.description);
  const ownership = await resolveActiveOwner(database, body);
  const applicationId = `application_${crypto.randomUUID()}`;
  const resourceIdentifier = normalizeResourceIdentifier(
    body.resourceIdentifier ?? "",
    environment,
    applicationId,
  );
  const existingResource = await database
    .select({ id: oauthResource.id })
    .from(oauthResource)
    .where(eq(oauthResource.identifier, resourceIdentifier))
    .get();
  if (existingResource) throw new ApiError(409);

  const now = Date.now();
  await database.batch([
    database.insert(applications).values({
      id: applicationId,
      name,
      description,
      status: "active",
      disabledAt: null,
      ownerUserPrincipalId: ownership.ownerUserPrincipalId,
      ownerTeamId: ownership.ownerTeamId,
      authzVersion: 1,
      createdAt: now,
      updatedAt: now,
    }),
    database.insert(oauthResource).values({
      id: `resource_${crypto.randomUUID()}`,
      identifier: resourceIdentifier,
      name,
      accessTokenTtl: 3600,
      refreshTokenTtl: null,
      signingAlgorithm: null,
      signingKeyId: null,
      allowedScopes: [...SUPPORTED_SCOPES],
      customClaims: {},
      dpopBoundAccessTokensRequired: false,
      disabled: false,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      policyVersion: 1,
      metadata: null,
    }),
    database.insert(applicationResources).values({
      applicationId,
      resourceIdentifier,
      createdAt: now,
    }),
    auditStatement(
      database,
      `application:created:${applicationId}`,
      "application.created",
      actor.principalId,
      null,
      null,
      { applicationId, name, owner: ownership.owner, resourceIdentifier },
      now,
    ),
    outboxStatement(
      database,
      `application:created:outbox:${applicationId}`,
      "application.created",
      "application",
      applicationId,
      { applicationId, name, resourceIdentifier },
      now,
    ),
  ]);
  return toApplication(database, await readApplicationRow(database, applicationId));
}

export async function updateApplication(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  body: ApplicationUpdateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-update", 60, 60);
  if (body.name === undefined && body.description === undefined) throw new ApiError(400);
  const database = createDb(environment.DB);
  const current = await readApplicationRow(database, applicationId);
  if (current.status !== "active") throw new ApiError(404);
  const name = body.name === undefined ? current.name : normalizeName(body.name);
  const description =
    body.description === undefined ? current.description : normalizeDescription(body.description);
  const now = Date.now();
  const changed = database
    .update(applications)
    .set({ name, description, updatedAt: now })
    .where(and(eq(applications.id, applicationId), eq(applications.status, "active")))
    .returning({ id: applications.id });
  const resourceChanged = database
    .update(oauthResource)
    .set({ name, updatedAt: new Date(now) })
    .where(eq(oauthResource.identifier, current.resourceIdentifier));
  const updated = database
    .select({ value: applications.id })
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.updatedAt, now)));
  const result = await database.batch([
    changed,
    resourceChanged,
    auditStatementWhen(
      database,
      `application:updated:${applicationId}:${now}`,
      "application.updated",
      actor.principalId,
      null,
      null,
      { applicationId, name, description },
      now,
      updated,
    ),
    outboxStatementWhen(
      database,
      `application:updated:outbox:${applicationId}:${now}`,
      "application.updated",
      "application",
      applicationId,
      { applicationId, name, description },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return toApplication(database, await readApplicationRow(database, applicationId));
}

export async function transferApplicationOwnership(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  ownershipInput: OwnershipInput,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-transfer-ownership", 60, 60);
  const database = createDb(environment.DB);
  const current = await readApplicationRow(database, applicationId);
  if (current.status !== "active") throw new ApiError(404);
  const ownership = await resolveActiveOwner(database, ownershipInput);
  const now = Date.now();
  const changed = database
    .update(applications)
    .set({
      ownerUserPrincipalId: ownership.ownerUserPrincipalId,
      ownerTeamId: ownership.ownerTeamId,
      updatedAt: now,
    })
    .where(eq(applications.id, applicationId))
    .returning({ id: applications.id });
  const updated = database
    .select({ value: applications.id })
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.updatedAt, now)));
  const result = await database.batch([
    changed,
    auditStatementWhen(
      database,
      `application:ownership:${applicationId}:${now}`,
      "application.ownership_transferred",
      actor.principalId,
      null,
      null,
      { applicationId, owner: ownership.owner },
      now,
      updated,
    ),
    outboxStatementWhen(
      database,
      `application:ownership:outbox:${applicationId}:${now}`,
      "application.ownership_transferred",
      "application",
      applicationId,
      { applicationId, owner: ownership.owner },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return toApplication(database, await readApplicationRow(database, applicationId));
}

export async function setApplicationDisabled(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  disabled: boolean,
  request: Request,
) {
  await enforceRateLimit(
    environment,
    request,
    disabled ? "application-disable" : "application-enable",
    60,
    60,
  );
  const database = createDb(environment.DB);
  const current = await readApplicationRow(database, applicationId);
  const nextStatus = disabled ? "disabled" : "active";
  if (current.status === nextStatus) return { id: applicationId, status: current.status } as const;
  if (!disabled) {
    await resolveActiveOwner(database, {
      ownerId: current.ownerUserPrincipalId ?? current.ownerTeamId ?? "",
      ownerType: current.ownerUserPrincipalId ? "user" : "team",
    });
  }
  const now = Date.now();
  const changed = database
    .update(applications)
    .set({
      status: nextStatus,
      disabledAt: disabled ? now : null,
      authzVersion: sql`${applications.authzVersion} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(applications.id, applicationId),
        eq(applications.status, disabled ? "active" : "disabled"),
      ),
    )
    .returning({ id: applications.id });
  const resourceChanged = database
    .update(oauthResource)
    .set({ disabled, updatedAt: new Date(now) })
    .where(eq(oauthResource.identifier, current.resourceIdentifier));
  const updated = database
    .select({ value: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.id, applicationId),
        eq(applications.status, nextStatus),
        eq(applications.updatedAt, now),
      ),
    );
  const result = await database.batch([
    changed,
    resourceChanged,
    auditStatementWhen(
      database,
      `application:${disabled ? "disabled" : "enabled"}:${applicationId}:${now}`,
      `application.${disabled ? "disabled" : "enabled"}`,
      actor.principalId,
      null,
      null,
      { applicationId, status: nextStatus },
      now,
      updated,
    ),
    outboxStatementWhen(
      database,
      `application:${disabled ? "disabled" : "enabled"}:outbox:${applicationId}:${now}`,
      `application.${disabled ? "disabled" : "enabled"}`,
      "application",
      applicationId,
      { applicationId, status: nextStatus },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return { id: applicationId, status: nextStatus } as const;
}

export async function deleteApplication(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-delete", 30, 60);
  const database = createDb(environment.DB);
  const current = await readApplicationRow(database, applicationId);
  const [clients, roles, userAssignments, serviceAssignments, teamAssignments] = await Promise.all([
    database
      .select({ id: applicationOauthClients.clientId })
      .from(applicationOauthClients)
      .where(eq(applicationOauthClients.applicationId, applicationId))
      .all(),
    database
      .select({ id: applicationRoles.id })
      .from(applicationRoles)
      .where(eq(applicationRoles.applicationId, applicationId))
      .all(),
    database
      .select({ id: userApplicationAssignments.id })
      .from(userApplicationAssignments)
      .where(eq(userApplicationAssignments.applicationId, applicationId))
      .all(),
    database
      .select({ id: serviceAccountApplicationAssignments.id })
      .from(serviceAccountApplicationAssignments)
      .where(eq(serviceAccountApplicationAssignments.applicationId, applicationId))
      .all(),
    database
      .select({ id: teamApplicationAssignments.id })
      .from(teamApplicationAssignments)
      .where(eq(teamApplicationAssignments.applicationId, applicationId))
      .all(),
  ]);
  if (
    clients.length ||
    roles.length ||
    userAssignments.length ||
    serviceAssignments.length ||
    teamAssignments.length
  ) {
    throw new ApiError(409);
  }
  const now = Date.now();
  await database.batch([
    database
      .delete(applicationResources)
      .where(eq(applicationResources.applicationId, applicationId)),
    database.delete(oauthResource).where(eq(oauthResource.identifier, current.resourceIdentifier)),
    database.delete(applications).where(eq(applications.id, applicationId)),
    auditStatement(
      database,
      `application:deleted:${applicationId}:${now}`,
      "application.deleted",
      actor.principalId,
      null,
      null,
      { applicationId },
      now,
    ),
    outboxStatement(
      database,
      `application:deleted:outbox:${applicationId}:${now}`,
      "application.deleted",
      "application",
      applicationId,
      { applicationId },
      now,
    ),
  ]);
  return { id: applicationId, status: "deleted" as const };
}

export async function listApplicationRoles(environment: AuthEnvironment, applicationId: string) {
  const database = createDb(environment.DB);
  await readApplicationRow(database, applicationId);
  const roles = await database
    .select()
    .from(applicationRoles)
    .where(eq(applicationRoles.applicationId, applicationId))
    .orderBy(asc(applicationRoles.key))
    .all();
  const [userGrants, serviceGrants, teamGrants] = await Promise.all([
    database
      .select({ roleId: userApplicationRoleGrants.roleId })
      .from(userApplicationRoleGrants)
      .where(eq(userApplicationRoleGrants.applicationId, applicationId))
      .all(),
    database
      .select({ roleId: serviceAccountApplicationRoleGrants.roleId })
      .from(serviceAccountApplicationRoleGrants)
      .where(eq(serviceAccountApplicationRoleGrants.applicationId, applicationId))
      .all(),
    database
      .select({ roleId: teamApplicationRoleGrants.roleId })
      .from(teamApplicationRoleGrants)
      .where(eq(teamApplicationRoleGrants.applicationId, applicationId))
      .all(),
  ]);
  const counts = new Map<string, number>();
  for (const row of [...userGrants, ...serviceGrants, ...teamGrants])
    counts.set(row.roleId, (counts.get(row.roleId) ?? 0) + 1);
  return roles.map(
    (role) =>
      ({
        id: role.id,
        applicationId: role.applicationId,
        key: role.key,
        name: role.name,
        description: role.description,
        status: role.status,
        grantCount: counts.get(role.id) ?? 0,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      }) satisfies ApplicationRole,
  );
}

export async function createApplicationRole(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  body: ApplicationRoleCreateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-role-create", 120, 60);
  const database = createDb(environment.DB);
  const application = await readApplicationRow(database, applicationId);
  if (application.status !== "active") throw new ApiError(404);
  const key = normalizeRoleKey(body.key);
  const name = normalizeName(body.name);
  const description = normalizeDescription(body.description);
  const existing = await database
    .select({ id: applicationRoles.id })
    .from(applicationRoles)
    .where(and(eq(applicationRoles.applicationId, applicationId), eq(applicationRoles.key, key)))
    .get();
  if (existing) throw new ApiError(409);
  const roleId = `application-role_${crypto.randomUUID()}`;
  const now = Date.now();
  await database.batch([
    database.insert(applicationRoles).values({
      id: roleId,
      applicationId,
      key,
      name,
      description,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-role:created:${roleId}`,
      "application_role.created",
      actor.principalId,
      null,
      null,
      { applicationId, roleId, key },
      now,
    ),
    outboxStatement(
      database,
      `application-role:created:outbox:${roleId}`,
      "application_role.created",
      "application",
      applicationId,
      { applicationId, roleId, key },
      now,
    ),
  ]);
  return {
    id: roleId,
    applicationId,
    key,
    name,
    description,
    status: "active" as const,
    grantCount: 0,
    createdAt: now,
    updatedAt: now,
  } satisfies ApplicationRole;
}

export async function updateApplicationRole(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  roleKey: string,
  body: ApplicationRoleUpdateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-role-update", 120, 60);
  if (body.name === undefined && body.description === undefined && body.status === undefined)
    throw new ApiError(400);
  const database = createDb(environment.DB);
  const current = await database
    .select()
    .from(applicationRoles)
    .where(
      and(
        eq(applicationRoles.applicationId, applicationId),
        eq(applicationRoles.key, normalizeRoleKey(roleKey)),
      ),
    )
    .get();
  if (!current) throw new ApiError(404);
  const name = body.name === undefined ? current.name : normalizeName(body.name);
  const description =
    body.description === undefined ? current.description : normalizeDescription(body.description);
  const status = body.status ?? current.status;
  const now = Date.now();
  const changed = database
    .update(applicationRoles)
    .set({ name, description, status, updatedAt: now })
    .where(eq(applicationRoles.id, current.id))
    .returning({ id: applicationRoles.id });
  const version = database
    .select({ value: applicationRoles.id })
    .from(applicationRoles)
    .where(and(eq(applicationRoles.id, current.id), eq(applicationRoles.updatedAt, now)));
  const result = await database.batch([
    changed,
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatementWhen(
      database,
      `application-role:updated:${current.id}:${now}`,
      "application_role.updated",
      actor.principalId,
      null,
      null,
      { applicationId, roleId: current.id, key: current.key, name, description, status },
      now,
      version,
    ),
    outboxStatementWhen(
      database,
      `application-role:updated:outbox:${current.id}:${now}`,
      "application_role.updated",
      "application",
      applicationId,
      { applicationId, roleId: current.id, key: current.key, status },
      now,
      version,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  const updated = await database
    .select()
    .from(applicationRoles)
    .where(eq(applicationRoles.id, current.id))
    .get();
  if (!updated) throw new ApiError(404);
  const [userGrants, serviceGrants, teamGrants] = await Promise.all([
    database
      .select({ id: userApplicationRoleGrants.id })
      .from(userApplicationRoleGrants)
      .where(eq(userApplicationRoleGrants.roleId, current.id))
      .all(),
    database
      .select({ id: serviceAccountApplicationRoleGrants.id })
      .from(serviceAccountApplicationRoleGrants)
      .where(eq(serviceAccountApplicationRoleGrants.roleId, current.id))
      .all(),
    database
      .select({ id: teamApplicationRoleGrants.id })
      .from(teamApplicationRoleGrants)
      .where(eq(teamApplicationRoleGrants.roleId, current.id))
      .all(),
  ]);
  return {
    id: updated.id,
    applicationId,
    key: updated.key,
    name: updated.name,
    description: updated.description,
    status: updated.status,
    grantCount: userGrants.length + serviceGrants.length + teamGrants.length,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  } satisfies ApplicationRole;
}

export async function deleteApplicationRole(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  roleKey: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-role-delete", 60, 60);
  const database = createDb(environment.DB);
  const current = await database
    .select({ id: applicationRoles.id })
    .from(applicationRoles)
    .where(
      and(
        eq(applicationRoles.applicationId, applicationId),
        eq(applicationRoles.key, normalizeRoleKey(roleKey)),
      ),
    )
    .get();
  if (!current) throw new ApiError(404);
  const [userGrants, serviceGrants, teamGrants] = await Promise.all([
    database
      .select({ id: userApplicationRoleGrants.id })
      .from(userApplicationRoleGrants)
      .where(eq(userApplicationRoleGrants.roleId, current.id))
      .all(),
    database
      .select({ id: serviceAccountApplicationRoleGrants.id })
      .from(serviceAccountApplicationRoleGrants)
      .where(eq(serviceAccountApplicationRoleGrants.roleId, current.id))
      .all(),
    database
      .select({ id: teamApplicationRoleGrants.id })
      .from(teamApplicationRoleGrants)
      .where(eq(teamApplicationRoleGrants.roleId, current.id))
      .all(),
  ]);
  if (userGrants.length || serviceGrants.length || teamGrants.length) throw new ApiError(409);
  const now = Date.now();
  await database.batch([
    database.delete(applicationRoles).where(eq(applicationRoles.id, current.id)),
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-role:deleted:${current.id}:${now}`,
      "application_role.deleted",
      actor.principalId,
      null,
      null,
      { applicationId, roleId: current.id, roleKey },
      now,
    ),
    outboxStatement(
      database,
      `application-role:deleted:outbox:${current.id}:${now}`,
      "application_role.deleted",
      "application",
      applicationId,
      { applicationId, roleId: current.id, roleKey },
      now,
    ),
  ]);
  return { id: current.id, status: "deleted" as const };
}

async function resolveSubject(
  database: AppDb,
  subjectType: ApplicationSubjectType,
  subjectId: string,
): Promise<ResolvedSubject> {
  if (subjectType === "user") {
    const row = await database
      .select({
        principalId: principals.id,
        userId: humanPrincipals.userId,
        status: principals.status,
        name: user.name,
      })
      .from(principals)
      .innerJoin(humanPrincipals, eq(humanPrincipals.principalId, principals.id))
      .innerJoin(user, eq(user.id, humanPrincipals.userId))
      .where(or(eq(principals.id, subjectId), eq(humanPrincipals.userId, subjectId)))
      .get();
    if (!row) throw new ApiError(404);
    return {
      id: row.userId,
      principalId: row.principalId,
      userId: row.userId,
      type: "user",
      status: row.status,
      name: row.name,
    };
  }
  if (subjectType === "service-account") {
    const row = await database
      .select({ principalId: principals.id, status: principals.status, name: serviceAccounts.name })
      .from(serviceAccounts)
      .innerJoin(principals, eq(principals.id, serviceAccounts.principalId))
      .where(eq(serviceAccounts.principalId, subjectId))
      .get();
    if (!row) throw new ApiError(404);
    return {
      id: row.principalId,
      principalId: row.principalId,
      userId: null,
      type: subjectType,
      status: row.status,
      name: row.name,
    };
  }
  const row = await database
    .select({ id: teams.id, status: teams.status, name: teams.name })
    .from(teams)
    .where(eq(teams.id, subjectId))
    .get();
  if (!row) throw new ApiError(404);
  return {
    id: row.id,
    principalId: null,
    userId: null,
    type: subjectType,
    status: row.status,
    name: row.name,
  };
}

function assertActiveSubject(subject: ResolvedSubject) {
  if (subject.status !== "active") throw new ApiError(409);
}

export async function setApplicationAssignment(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  body: ApplicationAssignmentBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-assignment-set", 180, 60);
  const database = createDb(environment.DB);
  const application = await readApplicationRow(database, applicationId);
  if (application.status !== "active") throw new ApiError(404);
  const subject = await resolveSubject(database, body.subjectType, body.subjectId);
  assertActiveSubject(subject);
  const status = body.status ?? "active";
  const now = Date.now();
  if (body.subjectType === "user") {
    const current = await database
      .select()
      .from(userApplicationAssignments)
      .where(
        and(
          eq(userApplicationAssignments.applicationId, applicationId),
          eq(userApplicationAssignments.userPrincipalId, subject.principalId ?? ""),
        ),
      )
      .get();
    if (current?.status === status)
      return {
        applicationId,
        subjectId: subject.principalId ?? "",
        subjectType: body.subjectType,
        status,
      } as const;
    const mutation = current
      ? database
          .update(userApplicationAssignments)
          .set({ status, updatedAt: now })
          .where(eq(userApplicationAssignments.id, current.id))
          .returning({ id: userApplicationAssignments.id })
      : database
          .insert(userApplicationAssignments)
          .values({
            id: `user-assignment_${crypto.randomUUID()}`,
            applicationId,
            userPrincipalId: subject.principalId ?? "",
            status,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: userApplicationAssignments.id });
    const result = await database.batch([
      mutation,
      applicationAuthzVersionStatement(database, applicationId, now),
      auditStatement(
        database,
        `application-assignment:${body.subjectType}:${subject.principalId}:${now}`,
        "application.assignment_set",
        actor.principalId,
        subject.principalId,
        subject.userId,
        { applicationId, subjectType: body.subjectType, status },
        now,
      ),
      outboxStatement(
        database,
        `application-assignment:outbox:${body.subjectType}:${subject.principalId}:${now}`,
        "application.assignment_set",
        "application",
        applicationId,
        { applicationId, subjectType: body.subjectType, subjectId: subject.principalId, status },
        now,
      ),
    ]);
    if (!result[0]?.length) throw new ApiError(409);
    return {
      applicationId,
      subjectId: subject.principalId ?? "",
      subjectType: body.subjectType,
      status,
    } as const;
  }
  if (body.subjectType === "service-account") {
    const current = await database
      .select()
      .from(serviceAccountApplicationAssignments)
      .where(
        and(
          eq(serviceAccountApplicationAssignments.applicationId, applicationId),
          eq(serviceAccountApplicationAssignments.serviceAccountPrincipalId, subject.id),
        ),
      )
      .get();
    if (current?.status === status)
      return {
        applicationId,
        subjectId: subject.id,
        subjectType: body.subjectType,
        status,
      } as const;
    const mutation = current
      ? database
          .update(serviceAccountApplicationAssignments)
          .set({ status, updatedAt: now })
          .where(eq(serviceAccountApplicationAssignments.id, current.id))
          .returning({ id: serviceAccountApplicationAssignments.id })
      : database
          .insert(serviceAccountApplicationAssignments)
          .values({
            id: `service-assignment_${crypto.randomUUID()}`,
            applicationId,
            serviceAccountPrincipalId: subject.id,
            status,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: serviceAccountApplicationAssignments.id });
    const result = await database.batch([
      mutation,
      applicationAuthzVersionStatement(database, applicationId, now),
      auditStatement(
        database,
        `application-assignment:${body.subjectType}:${subject.id}:${now}`,
        "application.assignment_set",
        actor.principalId,
        subject.principalId,
        null,
        { applicationId, subjectType: body.subjectType, status },
        now,
      ),
      outboxStatement(
        database,
        `application-assignment:outbox:${body.subjectType}:${subject.id}:${now}`,
        "application.assignment_set",
        "application",
        applicationId,
        { applicationId, subjectType: body.subjectType, subjectId: subject.id, status },
        now,
      ),
    ]);
    if (!result[0]?.length) throw new ApiError(409);
    return { applicationId, subjectId: subject.id, subjectType: body.subjectType, status } as const;
  }
  const current = await database
    .select()
    .from(teamApplicationAssignments)
    .where(
      and(
        eq(teamApplicationAssignments.applicationId, applicationId),
        eq(teamApplicationAssignments.teamId, subject.id),
      ),
    )
    .get();
  if (current?.status === status)
    return { applicationId, subjectId: subject.id, subjectType: body.subjectType, status } as const;
  const mutation = current
    ? database
        .update(teamApplicationAssignments)
        .set({ status, updatedAt: now })
        .where(eq(teamApplicationAssignments.id, current.id))
        .returning({ id: teamApplicationAssignments.id })
    : database
        .insert(teamApplicationAssignments)
        .values({
          id: `team-assignment_${crypto.randomUUID()}`,
          applicationId,
          teamId: subject.id,
          status,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: teamApplicationAssignments.id });
  const result = await database.batch([
    mutation,
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-assignment:${body.subjectType}:${subject.id}:${now}`,
      "application.assignment_set",
      actor.principalId,
      null,
      null,
      { applicationId, subjectType: body.subjectType, status },
      now,
    ),
    outboxStatement(
      database,
      `application-assignment:outbox:${body.subjectType}:${subject.id}:${now}`,
      "application.assignment_set",
      "application",
      applicationId,
      { applicationId, subjectType: body.subjectType, subjectId: subject.id, status },
      now,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return { applicationId, subjectId: subject.id, subjectType: body.subjectType, status } as const;
}

export async function removeApplicationAssignment(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  subjectType: ApplicationSubjectType,
  subjectId: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-assignment-remove", 180, 60);
  const database = createDb(environment.DB);
  await readApplicationRow(database, applicationId);
  const subject = await resolveSubject(database, subjectType, subjectId);
  const now = Date.now();
  let mutation;
  if (subjectType === "user") {
    mutation = database
      .delete(userApplicationAssignments)
      .where(
        and(
          eq(userApplicationAssignments.applicationId, applicationId),
          eq(userApplicationAssignments.userPrincipalId, subject.principalId ?? ""),
        ),
      )
      .returning({ id: userApplicationAssignments.id });
  } else if (subjectType === "service-account") {
    mutation = database
      .delete(serviceAccountApplicationAssignments)
      .where(
        and(
          eq(serviceAccountApplicationAssignments.applicationId, applicationId),
          eq(serviceAccountApplicationAssignments.serviceAccountPrincipalId, subject.id),
        ),
      )
      .returning({ id: serviceAccountApplicationAssignments.id });
  } else {
    mutation = database
      .delete(teamApplicationAssignments)
      .where(
        and(
          eq(teamApplicationAssignments.applicationId, applicationId),
          eq(teamApplicationAssignments.teamId, subject.id),
        ),
      )
      .returning({ id: teamApplicationAssignments.id });
  }
  const result = await database.batch([
    mutation,
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-assignment:removed:${subjectType}:${subject.id}:${now}`,
      "application.assignment_removed",
      actor.principalId,
      subject.principalId,
      subject.userId,
      { applicationId, subjectType, subjectId: subject.id },
      now,
    ),
    outboxStatement(
      database,
      `application-assignment:removed:outbox:${subjectType}:${subject.id}:${now}`,
      "application.assignment_removed",
      "application",
      applicationId,
      { applicationId, subjectType, subjectId: subject.id },
      now,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(404);
  return {
    applicationId,
    subjectId: subject.principalId ?? subject.id,
    subjectType,
    status: "removed" as const,
  };
}

export async function grantApplicationRole(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  body: ApplicationRoleGrantBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-role-grant", 180, 60);
  const database = createDb(environment.DB);
  const application = await readApplicationRow(database, applicationId);
  if (application.status !== "active") throw new ApiError(404);
  const subject = await resolveSubject(database, body.subjectType, body.subjectId);
  assertActiveSubject(subject);
  const role = await database
    .select({ id: applicationRoles.id, key: applicationRoles.key })
    .from(applicationRoles)
    .where(
      and(
        eq(applicationRoles.applicationId, applicationId),
        eq(applicationRoles.key, normalizeRoleKey(body.roleKey)),
        eq(applicationRoles.status, "active"),
      ),
    )
    .get();
  if (!role) throw new ApiError(404);
  const subjectKey = subject.principalId ?? subject.id;
  if (body.subjectType === "user") {
    const current = await database
      .select({ id: userApplicationRoleGrants.id })
      .from(userApplicationRoleGrants)
      .where(
        and(
          eq(userApplicationRoleGrants.applicationId, applicationId),
          eq(userApplicationRoleGrants.userPrincipalId, subjectKey),
          eq(userApplicationRoleGrants.roleId, role.id),
        ),
      )
      .get();
    if (current)
      return {
        applicationId,
        subjectId: subjectKey,
        subjectType: body.subjectType,
        roleKey: role.key,
        status: "granted" as const,
      };
    const now = Date.now();
    const mutation = database
      .insert(userApplicationRoleGrants)
      .values({
        id: `user-role-grant_${crypto.randomUUID()}`,
        applicationId,
        userPrincipalId: subjectKey,
        roleId: role.id,
        grantedByPrincipalId: actor.principalId,
        createdAt: now,
      })
      .returning({ id: userApplicationRoleGrants.id });
    const result = await database.batch([
      mutation,
      applicationAuthzVersionStatement(database, applicationId, now),
      auditStatement(
        database,
        `application-role:granted:user:${subjectKey}:${role.id}:${now}`,
        "application_role.granted",
        actor.principalId,
        subject.principalId,
        subject.userId,
        { applicationId, subjectType: body.subjectType, subjectId: subjectKey, roleKey: role.key },
        now,
      ),
      outboxStatement(
        database,
        `application-role:granted:outbox:user:${subjectKey}:${role.id}:${now}`,
        "application_role.granted",
        "application",
        applicationId,
        { applicationId, subjectType: body.subjectType, subjectId: subjectKey, roleKey: role.key },
        now,
      ),
    ]);
    if (!result[0]?.length) throw new ApiError(409);
    return {
      applicationId,
      subjectId: subjectKey,
      subjectType: body.subjectType,
      roleKey: role.key,
      status: "granted" as const,
    };
  }
  if (body.subjectType === "service-account") {
    const current = await database
      .select({ id: serviceAccountApplicationRoleGrants.id })
      .from(serviceAccountApplicationRoleGrants)
      .where(
        and(
          eq(serviceAccountApplicationRoleGrants.applicationId, applicationId),
          eq(serviceAccountApplicationRoleGrants.serviceAccountPrincipalId, subjectKey),
          eq(serviceAccountApplicationRoleGrants.roleId, role.id),
        ),
      )
      .get();
    if (current)
      return {
        applicationId,
        subjectId: subjectKey,
        subjectType: body.subjectType,
        roleKey: role.key,
        status: "granted" as const,
      };
    const now = Date.now();
    const mutation = database
      .insert(serviceAccountApplicationRoleGrants)
      .values({
        id: `service-role-grant_${crypto.randomUUID()}`,
        applicationId,
        serviceAccountPrincipalId: subjectKey,
        roleId: role.id,
        grantedByPrincipalId: actor.principalId,
        createdAt: now,
      })
      .returning({ id: serviceAccountApplicationRoleGrants.id });
    const result = await database.batch([
      mutation,
      applicationAuthzVersionStatement(database, applicationId, now),
      auditStatement(
        database,
        `application-role:granted:service:${subjectKey}:${role.id}:${now}`,
        "application_role.granted",
        actor.principalId,
        subject.principalId,
        null,
        { applicationId, subjectType: body.subjectType, subjectId: subjectKey, roleKey: role.key },
        now,
      ),
      outboxStatement(
        database,
        `application-role:granted:outbox:service:${subjectKey}:${role.id}:${now}`,
        "application_role.granted",
        "application",
        applicationId,
        { applicationId, subjectType: body.subjectType, subjectId: subjectKey, roleKey: role.key },
        now,
      ),
    ]);
    if (!result[0]?.length) throw new ApiError(409);
    return {
      applicationId,
      subjectId: subjectKey,
      subjectType: body.subjectType,
      roleKey: role.key,
      status: "granted" as const,
    };
  }
  const current = await database
    .select({ id: teamApplicationRoleGrants.id })
    .from(teamApplicationRoleGrants)
    .where(
      and(
        eq(teamApplicationRoleGrants.applicationId, applicationId),
        eq(teamApplicationRoleGrants.teamId, subjectKey),
        eq(teamApplicationRoleGrants.roleId, role.id),
      ),
    )
    .get();
  if (current)
    return {
      applicationId,
      subjectId: subjectKey,
      subjectType: body.subjectType,
      roleKey: role.key,
      status: "granted" as const,
    };
  const now = Date.now();
  const mutation = database
    .insert(teamApplicationRoleGrants)
    .values({
      id: `team-role-grant_${crypto.randomUUID()}`,
      applicationId,
      teamId: subjectKey,
      roleId: role.id,
      grantedByPrincipalId: actor.principalId,
      createdAt: now,
    })
    .returning({ id: teamApplicationRoleGrants.id });
  const result = await database.batch([
    mutation,
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-role:granted:team:${subjectKey}:${role.id}:${now}`,
      "application_role.granted",
      actor.principalId,
      null,
      null,
      { applicationId, subjectType: body.subjectType, subjectId: subjectKey, roleKey: role.key },
      now,
    ),
    outboxStatement(
      database,
      `application-role:granted:outbox:team:${subjectKey}:${role.id}:${now}`,
      "application_role.granted",
      "application",
      applicationId,
      { applicationId, subjectType: body.subjectType, subjectId: subjectKey, roleKey: role.key },
      now,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return {
    applicationId,
    subjectId: subjectKey,
    subjectType: body.subjectType,
    roleKey: role.key,
    status: "granted" as const,
  };
}

export async function revokeApplicationRole(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  subjectType: ApplicationSubjectType,
  subjectId: string,
  roleKey: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-role-revoke", 180, 60);
  const database = createDb(environment.DB);
  await readApplicationRow(database, applicationId);
  const subject = await resolveSubject(database, subjectType, subjectId);
  const role = await database
    .select({ id: applicationRoles.id, key: applicationRoles.key })
    .from(applicationRoles)
    .where(
      and(
        eq(applicationRoles.applicationId, applicationId),
        eq(applicationRoles.key, normalizeRoleKey(roleKey)),
      ),
    )
    .get();
  if (!role) throw new ApiError(404);
  const key = subject.principalId ?? subject.id;
  let mutation;
  if (subjectType === "user") {
    mutation = database
      .delete(userApplicationRoleGrants)
      .where(
        and(
          eq(userApplicationRoleGrants.applicationId, applicationId),
          eq(userApplicationRoleGrants.userPrincipalId, key),
          eq(userApplicationRoleGrants.roleId, role.id),
        ),
      )
      .returning({ id: userApplicationRoleGrants.id });
  } else if (subjectType === "service-account") {
    mutation = database
      .delete(serviceAccountApplicationRoleGrants)
      .where(
        and(
          eq(serviceAccountApplicationRoleGrants.applicationId, applicationId),
          eq(serviceAccountApplicationRoleGrants.serviceAccountPrincipalId, key),
          eq(serviceAccountApplicationRoleGrants.roleId, role.id),
        ),
      )
      .returning({ id: serviceAccountApplicationRoleGrants.id });
  } else {
    mutation = database
      .delete(teamApplicationRoleGrants)
      .where(
        and(
          eq(teamApplicationRoleGrants.applicationId, applicationId),
          eq(teamApplicationRoleGrants.teamId, key),
          eq(teamApplicationRoleGrants.roleId, role.id),
        ),
      )
      .returning({ id: teamApplicationRoleGrants.id });
  }
  const now = Date.now();
  const result = await database.batch([
    mutation,
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-role:revoked:${subjectType}:${key}:${role.id}:${now}`,
      "application_role.revoked",
      actor.principalId,
      subject.principalId,
      subject.userId,
      { applicationId, subjectType, subjectId: key, roleKey: role.key },
      now,
    ),
    outboxStatement(
      database,
      `application-role:revoked:outbox:${subjectType}:${key}:${role.id}:${now}`,
      "application_role.revoked",
      "application",
      applicationId,
      { applicationId, subjectType, subjectId: key, roleKey: role.key },
      now,
    ),
  ]);
  if (!result[0]?.length)
    return {
      applicationId,
      subjectId: key,
      subjectType,
      roleKey: role.key,
      status: "revoked" as const,
    };
  return {
    applicationId,
    subjectId: key,
    subjectType,
    roleKey: role.key,
    status: "revoked" as const,
  };
}

export async function readApplicationAccess(environment: AuthEnvironment, applicationId: string) {
  const database = createDb(environment.DB);
  await readApplicationRow(database, applicationId);
  const [
    users,
    serviceRows,
    teamRows,
    userAssignments,
    serviceAssignments,
    teamAssignments,
    userGrants,
    serviceGrants,
    teamGrants,
    memberships,
  ] = await Promise.all([
    database
      .select({
        id: user.id,
        principalId: humanPrincipals.principalId,
        name: user.name,
        email: user.email,
        status: principals.status,
        humanStatus: humanPrincipals.status,
        disabled: humanPrincipals.disabled,
      })
      .from(user)
      .innerJoin(humanPrincipals, eq(humanPrincipals.userId, user.id))
      .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
      .orderBy(asc(user.name))
      .all(),
    database
      .select({
        principalId: serviceAccounts.principalId,
        name: serviceAccounts.name,
        status: principals.status,
      })
      .from(serviceAccounts)
      .innerJoin(principals, eq(principals.id, serviceAccounts.principalId))
      .orderBy(asc(serviceAccounts.name))
      .all(),
    database
      .select({ id: teams.id, name: teams.name, status: teams.status })
      .from(teams)
      .orderBy(asc(teams.name))
      .all(),
    database
      .select()
      .from(userApplicationAssignments)
      .where(eq(userApplicationAssignments.applicationId, applicationId))
      .all(),
    database
      .select()
      .from(serviceAccountApplicationAssignments)
      .where(eq(serviceAccountApplicationAssignments.applicationId, applicationId))
      .all(),
    database
      .select()
      .from(teamApplicationAssignments)
      .where(eq(teamApplicationAssignments.applicationId, applicationId))
      .all(),
    database
      .select({ principalId: userApplicationRoleGrants.userPrincipalId, key: applicationRoles.key })
      .from(userApplicationRoleGrants)
      .innerJoin(applicationRoles, eq(applicationRoles.id, userApplicationRoleGrants.roleId))
      .where(
        and(
          eq(userApplicationRoleGrants.applicationId, applicationId),
          eq(applicationRoles.status, "active"),
        ),
      )
      .all(),
    database
      .select({
        principalId: serviceAccountApplicationRoleGrants.serviceAccountPrincipalId,
        key: applicationRoles.key,
      })
      .from(serviceAccountApplicationRoleGrants)
      .innerJoin(
        applicationRoles,
        eq(applicationRoles.id, serviceAccountApplicationRoleGrants.roleId),
      )
      .where(
        and(
          eq(serviceAccountApplicationRoleGrants.applicationId, applicationId),
          eq(applicationRoles.status, "active"),
        ),
      )
      .all(),
    database
      .select({ teamId: teamApplicationRoleGrants.teamId, key: applicationRoles.key })
      .from(teamApplicationRoleGrants)
      .innerJoin(applicationRoles, eq(applicationRoles.id, teamApplicationRoleGrants.roleId))
      .where(
        and(
          eq(teamApplicationRoleGrants.applicationId, applicationId),
          eq(applicationRoles.status, "active"),
        ),
      )
      .all(),
    database
      .select({
        teamId: teamMemberships.teamId,
        principalId: teamMemberships.userPrincipalId,
        teamName: teams.name,
        teamStatus: teams.status,
      })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .all(),
  ]);
  const userAssignmentMap = new Map(
    userAssignments.map((row) => [row.userPrincipalId, row.status]),
  );
  const serviceAssignmentMap = new Map(
    serviceAssignments.map((row) => [row.serviceAccountPrincipalId, row.status]),
  );
  const teamAssignmentMap = new Map(teamAssignments.map((row) => [row.teamId, row.status]));
  const directUserRoles = new Map<string, string[]>();
  for (const row of userGrants)
    directUserRoles.set(row.principalId, [
      ...(directUserRoles.get(row.principalId) ?? []),
      row.key,
    ]);
  const directServiceRoles = new Map<string, string[]>();
  for (const row of serviceGrants)
    directServiceRoles.set(row.principalId, [
      ...(directServiceRoles.get(row.principalId) ?? []),
      row.key,
    ]);
  const teamRoleMap = new Map<string, string[]>();
  for (const row of teamGrants)
    teamRoleMap.set(row.teamId, [...(teamRoleMap.get(row.teamId) ?? []), row.key]);
  const membershipsByPrincipal = new Map<string, typeof memberships>();
  for (const membership of memberships)
    membershipsByPrincipal.set(membership.principalId, [
      ...(membershipsByPrincipal.get(membership.principalId) ?? []),
      membership,
    ]);

  const userAccess = users.map((row) => {
    const directRoles = Array.from(new Set(directUserRoles.get(row.principalId) ?? []));
    const teamRoles = (membershipsByPrincipal.get(row.principalId) ?? [])
      .filter((membership) => membership.teamStatus === "active")
      .flatMap((membership) =>
        (teamRoleMap.get(membership.teamId) ?? []).map((roleKey) => ({
          kind: "team" as const,
          roleKey,
          teamId: membership.teamId,
          teamName: membership.teamName,
        })),
      );
    const teamAccess = (membershipsByPrincipal.get(row.principalId) ?? []).some(
      (membership) =>
        membership.teamStatus === "active" && teamAssignmentMap.get(membership.teamId) === "active",
    );
    const principalActive =
      row.status === "active" && row.humanStatus === "active" && !row.disabled;
    const effectiveRoles =
      principalActive && (userAssignmentMap.get(row.principalId) === "active" || teamAccess)
        ? Array.from(new Set([...directRoles, ...teamRoles.map((origin) => origin.roleKey)]))
        : [];
    return {
      id: row.id,
      principalId: row.principalId,
      name: row.name,
      email: row.email,
      status: principalActive ? ("active" as const) : ("disabled" as const),
      assignmentStatus: userAssignmentMap.get(row.principalId) ?? null,
      directRoles,
      teamRoles,
      effectiveRoles,
    };
  });
  const serviceAccountsAccess = serviceRows.map((row) => {
    const directRoles = Array.from(new Set(directServiceRoles.get(row.principalId) ?? []));
    return {
      id: row.principalId,
      principalId: row.principalId,
      name: row.name,
      status: row.status,
      assignmentStatus: serviceAssignmentMap.get(row.principalId) ?? null,
      directRoles,
      effectiveRoles:
        row.status === "active" && serviceAssignmentMap.get(row.principalId) === "active"
          ? directRoles
          : [],
    };
  });
  const teamsAccess = teamRows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    assignmentStatus: teamAssignmentMap.get(row.id) ?? null,
    directRoles: Array.from(new Set(teamRoleMap.get(row.id) ?? [])),
  }));
  return {
    applicationId,
    users: userAccess,
    serviceAccounts: serviceAccountsAccess,
    teams: teamsAccess,
  };
}

async function readApplicationClient(database: AppDb, applicationId: string, clientId: string) {
  const row = await database
    .select({
      applicationId: applicationOauthClients.applicationId,
      clientId: oauthClient.clientId,
      clientType: applicationOauthClients.clientType,
      name: oauthClient.name,
      redirectUris: oauthClient.redirectUris,
      scopes: oauthClient.scopes,
      disabled: oauthClient.disabled,
      createdAt: oauthClient.createdAt,
      updatedAt: oauthClient.updatedAt,
    })
    .from(applicationOauthClients)
    .innerJoin(oauthClient, eq(oauthClient.clientId, applicationOauthClients.clientId))
    .where(
      and(
        eq(applicationOauthClients.applicationId, applicationId),
        eq(applicationOauthClients.clientId, clientId),
      ),
    )
    .get();
  if (!row) throw new ApiError(404);
  return {
    applicationId: row.applicationId,
    clientId: row.clientId,
    clientType: row.clientType,
    name: row.name ?? row.clientId,
    redirectUris: parseStringArray(row.redirectUris),
    scopes: parseStringArray(row.scopes),
    disabled: Boolean(row.disabled),
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  } satisfies ApplicationClient;
}

export async function listApplicationClients(environment: AuthEnvironment, applicationId: string) {
  const database = createDb(environment.DB);
  await readApplicationRow(database, applicationId);
  const rows = await database
    .select({ clientId: applicationOauthClients.clientId })
    .from(applicationOauthClients)
    .where(eq(applicationOauthClients.applicationId, applicationId))
    .all();
  return Promise.all(
    rows.map((row) => readApplicationClient(database, applicationId, row.clientId)),
  );
}

export async function createApplicationClient(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  body: ApplicationClientCreateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-client-create", 60, 60);
  const database = createDb(environment.DB);
  const application = await readApplicationRow(database, applicationId);
  if (application.status !== "active") throw new ApiError(404);
  const name = normalizeName(body.name);
  const redirectUris = normalizeRedirectUris(body.redirectUris);
  const scopes = normalizeScopes(body.scopes);
  const clientId = `client_${crypto.randomUUID()}`;
  const clientSecret = body.clientType === "confidential" ? randomToken() : null;
  const now = Date.now();
  await database.batch([
    database.insert(oauthClient).values({
      id: crypto.randomUUID(),
      clientId,
      clientSecret: clientSecret ? await sha256Base64Url(clientSecret) : null,
      clientDiscoveryId: null,
      disabled: false,
      skipConsent: false,
      enableEndSession: false,
      subjectType: "public",
      scopes,
      clientCredentialsScopes: [],
      userId: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      name,
      uri: null,
      icon: null,
      contacts: null,
      tos: null,
      policy: null,
      softwareId: null,
      softwareVersion: null,
      softwareStatement: null,
      redirectUris,
      postLogoutRedirectUris: null,
      backchannelLogoutUri: null,
      backchannelLogoutSessionRequired: false,
      tokenEndpointAuthMethod: body.clientType === "confidential" ? "client_secret_basic" : "none",
      applicationType: "web",
      jwks: null,
      jwksUri: null,
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      requirePKCE: true,
      dpopBoundAccessTokens: false,
      referenceId: null,
      metadata: null,
    }),
    database.insert(oauthClientResource).values({
      id: crypto.randomUUID(),
      clientId,
      resourceId: application.resourceIdentifier,
      metadata: null,
      createdAt: new Date(now),
    }),
    database.insert(applicationOauthClients).values({
      clientId,
      applicationId,
      clientType: body.clientType,
      createdAt: now,
      updatedAt: now,
    }),
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-client:created:${clientId}`,
      "application_oauth_client.created",
      actor.principalId,
      null,
      null,
      { applicationId, clientId, clientType: body.clientType },
      now,
    ),
    outboxStatement(
      database,
      `application-client:created:outbox:${clientId}`,
      "application_oauth_client.created",
      "application",
      applicationId,
      { applicationId, clientId, clientType: body.clientType },
      now,
    ),
  ]);
  return { ...(await readApplicationClient(database, applicationId, clientId)), clientSecret };
}

export async function updateApplicationClient(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  clientId: string,
  body: ApplicationClientUpdateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-client-update", 60, 60);
  if (body.name === undefined && body.redirectUris === undefined && body.scopes === undefined)
    throw new ApiError(400);
  const database = createDb(environment.DB);
  const current = await readApplicationClient(database, applicationId, clientId);
  const name = body.name === undefined ? current.name : normalizeName(body.name);
  const redirectUris =
    body.redirectUris === undefined
      ? current.redirectUris
      : normalizeRedirectUris(body.redirectUris);
  const scopes = body.scopes === undefined ? current.scopes : normalizeScopes(body.scopes);
  const now = Date.now();
  const changed = database
    .update(oauthClient)
    .set({ name, redirectUris, scopes, updatedAt: new Date(now) })
    .where(eq(oauthClient.clientId, clientId))
    .returning({ clientId: oauthClient.clientId });
  const updated = database
    .select({ value: oauthClient.clientId })
    .from(oauthClient)
    .where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.updatedAt, new Date(now))));
  const result = await database.batch([
    changed,
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatementWhen(
      database,
      `application-client:updated:${clientId}:${now}`,
      "application_oauth_client.updated",
      actor.principalId,
      null,
      null,
      { applicationId, clientId },
      now,
      updated,
    ),
    outboxStatementWhen(
      database,
      `application-client:updated:outbox:${clientId}:${now}`,
      "application_oauth_client.updated",
      "application",
      applicationId,
      { applicationId, clientId },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return readApplicationClient(database, applicationId, clientId);
}

export async function setApplicationClientDisabled(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  clientId: string,
  disabled: boolean,
  request: Request,
) {
  await enforceRateLimit(
    environment,
    request,
    disabled ? "application-client-disable" : "application-client-enable",
    60,
    60,
  );
  const database = createDb(environment.DB);
  const current = await readApplicationClient(database, applicationId, clientId);
  if (current.disabled === disabled) return current;
  const now = Date.now();
  const changed = database
    .update(oauthClient)
    .set({ disabled, updatedAt: new Date(now) })
    .where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.disabled, !disabled)))
    .returning({ clientId: oauthClient.clientId });
  const updated = database
    .select({ value: oauthClient.clientId })
    .from(oauthClient)
    .where(
      and(
        eq(oauthClient.clientId, clientId),
        eq(oauthClient.disabled, disabled),
        eq(oauthClient.updatedAt, new Date(now)),
      ),
    );
  const result = await database.batch([
    changed,
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatementWhen(
      database,
      `application-client:${disabled ? "disabled" : "enabled"}:${clientId}:${now}`,
      `application_oauth_client.${disabled ? "disabled" : "enabled"}`,
      actor.principalId,
      null,
      null,
      { applicationId, clientId, disabled },
      now,
      updated,
    ),
    outboxStatementWhen(
      database,
      `application-client:${disabled ? "disabled" : "enabled"}:outbox:${clientId}:${now}`,
      `application_oauth_client.${disabled ? "disabled" : "enabled"}`,
      "application",
      applicationId,
      { applicationId, clientId, disabled },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return readApplicationClient(database, applicationId, clientId);
}

export async function deleteApplicationClient(
  environment: AuthEnvironment,
  actor: Actor,
  applicationId: string,
  clientId: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "application-client-delete", 30, 60);
  const database = createDb(environment.DB);
  await readApplicationClient(database, applicationId, clientId);
  const now = Date.now();
  await database.batch([
    database
      .delete(applicationOauthClients)
      .where(
        and(
          eq(applicationOauthClients.applicationId, applicationId),
          eq(applicationOauthClients.clientId, clientId),
        ),
      ),
    database.delete(oauthClient).where(eq(oauthClient.clientId, clientId)),
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `application-client:deleted:${clientId}:${now}`,
      "application_oauth_client.deleted",
      actor.principalId,
      null,
      null,
      { applicationId, clientId },
      now,
    ),
    outboxStatement(
      database,
      `application-client:deleted:outbox:${clientId}:${now}`,
      "application_oauth_client.deleted",
      "application",
      applicationId,
      { applicationId, clientId },
      now,
    ),
  ]);
  return { clientId, status: "deleted" as const };
}
