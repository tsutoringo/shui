import { and, asc, eq } from "drizzle-orm";

import { user } from "../../../db/auth-schema";
import { createDb } from "../../../db";
import { humanPrincipals, principals, serviceAccounts, teams } from "../../../db/domain-schema";
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
} from "../../shared/infrastructure";

type ServiceAccountCreateBody = OwnershipInput & {
  description?: string;
  name: string;
};

type ServiceAccountUpdateBody = {
  description?: string | null;
  name?: string;
  ownerId?: string;
  ownerType?: "user" | "team";
};

function normalizeServiceAccountName(name: string) {
  const normalized = name.normalize("NFKC").trim();
  if (!normalized || normalized.length > 160) throw new ApiError(400);
  return normalized;
}

function normalizeDescription(description: string | null | undefined) {
  if (description === undefined || description === null) return description ?? null;
  const normalized = description.normalize("NFKC").trim();
  if (normalized.length > 1000) throw new ApiError(400);
  return normalized || null;
}

export async function listServiceAccounts(environment: AuthEnvironment) {
  const db = createDb(environment.DB);
  const rows = await db
    .select({
      principalId: serviceAccounts.principalId,
      status: principals.status,
      name: serviceAccounts.name,
      description: serviceAccounts.description,
      ownerUserPrincipalId: serviceAccounts.ownerUserPrincipalId,
      ownerTeamId: serviceAccounts.ownerTeamId,
      createdAt: serviceAccounts.createdAt,
      updatedAt: serviceAccounts.updatedAt,
    })
    .from(serviceAccounts)
    .innerJoin(principals, eq(principals.id, serviceAccounts.principalId))
    .orderBy(asc(serviceAccounts.name))
    .all();
  const userOwners = await db
    .select({ principalId: principals.id, name: user.name, email: user.email })
    .from(principals)
    .innerJoin(humanPrincipals, eq(humanPrincipals.principalId, principals.id))
    .innerJoin(user, eq(user.id, humanPrincipals.userId))
    .all();
  const teamOwners = await db.select({ id: teams.id, name: teams.name }).from(teams).all();
  const userOwnerMap = new Map(userOwners.map((owner) => [owner.principalId, owner]));
  const teamOwnerMap = new Map(teamOwners.map((owner) => [owner.id, owner]));

  return rows.map((row) => ({
    id: row.principalId,
    principalId: row.principalId,
    name: row.name,
    description: row.description,
    status: row.status,
    owner: row.ownerUserPrincipalId
      ? {
          id: row.ownerUserPrincipalId,
          label: userOwnerMap.get(row.ownerUserPrincipalId)?.name ?? row.ownerUserPrincipalId,
          type: "user" as const,
        }
      : {
          id: row.ownerTeamId ?? "",
          label: teamOwnerMap.get(row.ownerTeamId ?? "")?.name ?? row.ownerTeamId ?? "",
          type: "team" as const,
        },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function createServiceAccount(
  environment: AuthEnvironment,
  actor: Actor,
  body: ServiceAccountCreateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "service-account-create", 60, 60);
  const db = createDb(environment.DB);
  const name = normalizeServiceAccountName(body.name);
  const description = normalizeDescription(body.description);
  const ownership = await resolveActiveOwner(db, body);
  const principalId = `service_${crypto.randomUUID()}`;
  const now = Date.now();

  await db.batch([
    db.insert(principals).values({
      id: principalId,
      type: "service",
      status: "active",
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(serviceAccounts).values({
      principalId,
      name,
      description,
      ownerUserPrincipalId: ownership.ownerUserPrincipalId,
      ownerTeamId: ownership.ownerTeamId,
      createdAt: now,
      updatedAt: now,
    }),
    auditStatement(
      db,
      `service-account:created:${principalId}`,
      "service_account.created",
      actor.principalId,
      principalId,
      null,
      { name, owner: ownership.owner },
      now,
    ),
    outboxStatement(
      db,
      `service-account:created:outbox:${principalId}`,
      "service_account.created",
      "principal",
      principalId,
      { name, owner: ownership.owner },
      now,
    ),
  ]);

  return {
    id: principalId,
    principalId,
    name,
    description,
    status: "active" as const,
    owner: ownership.owner,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateServiceAccount(
  environment: AuthEnvironment,
  actor: Actor,
  principalId: string,
  body: ServiceAccountUpdateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "service-account-update", 60, 60);
  if (body.name === undefined && body.description === undefined && body.ownerId === undefined) {
    throw new ApiError(400);
  }
  if ((body.ownerId === undefined) !== (body.ownerType === undefined)) throw new ApiError(400);

  const db = createDb(environment.DB);
  const current = await db
    .select({
      principalId: serviceAccounts.principalId,
      status: principals.status,
      name: serviceAccounts.name,
      description: serviceAccounts.description,
      ownerUserPrincipalId: serviceAccounts.ownerUserPrincipalId,
      ownerTeamId: serviceAccounts.ownerTeamId,
      createdAt: serviceAccounts.createdAt,
      updatedAt: serviceAccounts.updatedAt,
    })
    .from(serviceAccounts)
    .innerJoin(principals, eq(principals.id, serviceAccounts.principalId))
    .where(and(eq(serviceAccounts.principalId, principalId), eq(principals.type, "service")))
    .get();
  if (!current) throw new ApiError(404);
  const name = body.name === undefined ? current.name : normalizeServiceAccountName(body.name);
  const description =
    body.description === undefined ? current.description : normalizeDescription(body.description);
  const ownership =
    body.ownerId === undefined
      ? {
          ownerUserPrincipalId: current.ownerUserPrincipalId,
          ownerTeamId: current.ownerTeamId,
          owner: await readOwner(db, current.ownerUserPrincipalId, current.ownerTeamId),
        }
      : await resolveActiveOwner(db, {
          ownerId: body.ownerId,
          ownerType: body.ownerType ?? "user",
        });
  const now = Date.now();
  const changed = db
    .update(serviceAccounts)
    .set({
      name,
      description,
      ownerUserPrincipalId: ownership.ownerUserPrincipalId,
      ownerTeamId: ownership.ownerTeamId,
      updatedAt: now,
    })
    .where(eq(serviceAccounts.principalId, principalId))
    .returning({ id: serviceAccounts.principalId });
  const updated = db
    .select({ value: serviceAccounts.principalId })
    .from(serviceAccounts)
    .where(and(eq(serviceAccounts.principalId, principalId), eq(serviceAccounts.updatedAt, now)));
  const result = await db.batch([
    changed,
    auditStatementWhen(
      db,
      `service-account:updated:${principalId}:${now}`,
      "service_account.updated",
      actor.principalId,
      principalId,
      null,
      { name, description, owner: ownership.owner },
      now,
      updated,
    ),
    outboxStatementWhen(
      db,
      `service-account:updated:outbox:${principalId}:${now}`,
      "service_account.updated",
      "principal",
      principalId,
      { name, description, owner: ownership.owner },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return {
    id: principalId,
    principalId,
    name,
    description,
    status: current.status,
    owner: ownership.owner,
    createdAt: current.createdAt,
    updatedAt: now,
  };
}

export async function transferServiceAccountOwnership(
  environment: AuthEnvironment,
  actor: Actor,
  principalId: string,
  ownership: OwnershipInput,
  request: Request,
) {
  return updateServiceAccount(
    environment,
    actor,
    principalId,
    { ownerId: ownership.ownerId, ownerType: ownership.ownerType },
    request,
  );
}

export async function setServiceAccountDisabled(
  environment: AuthEnvironment,
  actor: Actor,
  principalId: string,
  disabled: boolean,
  request: Request,
) {
  await enforceRateLimit(
    environment,
    request,
    disabled ? "service-account-disable" : "service-account-enable",
    60,
    60,
  );
  const db = createDb(environment.DB);
  const current = await db
    .select({
      principalId: serviceAccounts.principalId,
      status: principals.status,
      ownerUserPrincipalId: serviceAccounts.ownerUserPrincipalId,
      ownerTeamId: serviceAccounts.ownerTeamId,
    })
    .from(serviceAccounts)
    .innerJoin(principals, eq(principals.id, serviceAccounts.principalId))
    .where(eq(serviceAccounts.principalId, principalId))
    .get();
  if (!current) throw new ApiError(404);
  if (current.status === (disabled ? "disabled" : "active")) {
    return { id: principalId, principalId, status: current.status };
  }
  if (!disabled) {
    await resolveActiveOwner(db, {
      ownerId: current.ownerUserPrincipalId ?? current.ownerTeamId ?? "",
      ownerType: current.ownerUserPrincipalId ? "user" : "team",
    });
  }

  const now = Date.now();
  const status = disabled ? "disabled" : "active";
  const changed = db
    .update(principals)
    .set({ status, disabledAt: disabled ? now : null, updatedAt: now })
    .where(
      and(
        eq(principals.id, principalId),
        eq(principals.type, "service"),
        eq(principals.status, disabled ? "active" : "disabled"),
      ),
    )
    .returning({ id: principals.id });
  const updated = db
    .select({ value: principals.id })
    .from(principals)
    .where(
      and(
        eq(principals.id, principalId),
        eq(principals.status, status),
        eq(principals.updatedAt, now),
      ),
    );
  const result = await db.batch([
    changed,
    auditStatementWhen(
      db,
      `service-account:${disabled ? "disabled" : "enabled"}:${principalId}:${now}`,
      `service_account.${disabled ? "disabled" : "enabled"}`,
      actor.principalId,
      principalId,
      null,
      {},
      now,
      updated,
    ),
    outboxStatementWhen(
      db,
      `service-account:${disabled ? "disabled" : "enabled"}:outbox:${principalId}:${now}`,
      `service_account.${disabled ? "disabled" : "enabled"}`,
      "principal",
      principalId,
      { status },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return { id: principalId, principalId, status: status as "active" | "disabled" };
}

async function readOwner(
  database: ReturnType<typeof createDb>,
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
