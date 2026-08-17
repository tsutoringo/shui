import { and, asc, eq } from "drizzle-orm";

import { user } from "../../../db/auth-schema";
import { createDb } from "../../../db";
import {
  applications,
  humanPrincipals,
  serviceAccounts,
  teamMemberships,
  teams,
} from "../../../db/domain-schema";
import { type AuthEnvironment } from "../../auth";
import { applicationsForTeamAuthzVersionStatement } from "../applications/service";
import { type Actor } from "../authorization/service";
import { ApiError } from "../errors";
import { resolveHumanPrincipal } from "../users/service";
import {
  auditStatement,
  auditStatementWhen,
  enforceRateLimit,
  outboxStatement,
  outboxStatementWhen,
} from "../../shared/infrastructure";

type TeamCreateBody = {
  description?: string;
  name: string;
};

type TeamUpdateBody = {
  description?: string | null;
  name?: string;
};

function normalizeTeamName(name: string) {
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

export async function listTeams(environment: AuthEnvironment) {
  const db = createDb(environment.DB);
  const teamRows = await db.select().from(teams).orderBy(asc(teams.name)).all();
  const memberRows = await db
    .select({
      id: teamMemberships.id,
      teamId: teamMemberships.teamId,
      principalId: teamMemberships.userPrincipalId,
      userId: humanPrincipals.userId,
      name: user.name,
      email: user.email,
    })
    .from(teamMemberships)
    .innerJoin(humanPrincipals, eq(humanPrincipals.principalId, teamMemberships.userPrincipalId))
    .innerJoin(user, eq(user.id, humanPrincipals.userId))
    .all();

  const membersByTeam = new Map<
    string,
    Array<{ email: string; id: string; name: string; principalId: string }>
  >();
  for (const member of memberRows) {
    const members = membersByTeam.get(member.teamId) ?? [];
    members.push({
      email: member.email,
      id: member.userId,
      name: member.name,
      principalId: member.principalId,
    });
    membersByTeam.set(member.teamId, members);
  }

  return teamRows.map((team) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    status: team.status,
    memberCount: membersByTeam.get(team.id)?.length ?? 0,
    members: membersByTeam.get(team.id) ?? [],
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  }));
}

export async function createTeam(
  environment: AuthEnvironment,
  actor: Actor,
  body: TeamCreateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "team-create", 60, 60);
  const db = createDb(environment.DB);
  const name = normalizeTeamName(body.name);
  const description = normalizeDescription(body.description);
  const id = `team_${crypto.randomUUID()}`;
  const now = Date.now();

  await db.batch([
    db.insert(teams).values({
      id,
      name,
      description,
      status: "active",
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    }),
    auditStatement(
      db,
      `team:created:${id}`,
      "team.created",
      actor.principalId,
      null,
      null,
      { id, name },
      now,
    ),
    outboxStatement(db, `team:created:outbox:${id}`, "team.created", "team", id, { id, name }, now),
  ]);

  return { id, name, description, status: "active" as const };
}

export async function updateTeam(
  environment: AuthEnvironment,
  actor: Actor,
  teamId: string,
  body: TeamUpdateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "team-update", 60, 60);
  if (body.name === undefined && body.description === undefined) throw new ApiError(400);
  const db = createDb(environment.DB);
  const current = await db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!current || current.status !== "active") throw new ApiError(404);
  const name = body.name === undefined ? current.name : normalizeTeamName(body.name);
  const description =
    body.description === undefined ? current.description : normalizeDescription(body.description);
  const now = Date.now();
  const changed = db
    .update(teams)
    .set({ name, description, updatedAt: now })
    .where(and(eq(teams.id, teamId), eq(teams.status, "active")))
    .returning({ id: teams.id });
  const updated = db
    .select({ value: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.updatedAt, now)));
  const result = await db.batch([
    changed,
    auditStatementWhen(
      db,
      `team:updated:${teamId}:${now}`,
      "team.updated",
      actor.principalId,
      null,
      null,
      { id: teamId, name, description },
      now,
      updated,
    ),
    outboxStatementWhen(
      db,
      `team:updated:outbox:${teamId}:${now}`,
      "team.updated",
      "team",
      teamId,
      { id: teamId, name, description },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return { id: teamId, name, description, status: "active" as const };
}

export async function setTeamDisabled(
  environment: AuthEnvironment,
  actor: Actor,
  teamId: string,
  disabled: boolean,
  request: Request,
) {
  await enforceRateLimit(environment, request, disabled ? "team-disable" : "team-enable", 60, 60);
  const db = createDb(environment.DB);
  const team = await db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!team) throw new ApiError(404);
  if (team.status === (disabled ? "disabled" : "active")) {
    return { id: teamId, status: team.status };
  }
  if (disabled) {
    await assertNoOwnedServiceAccounts(db, teamId);
    await assertNoOwnedApplications(db, teamId);
  }

  const now = Date.now();
  const status = disabled ? "disabled" : "active";
  const changed = db
    .update(teams)
    .set({ status, disabledAt: disabled ? now : null, updatedAt: now })
    .where(and(eq(teams.id, teamId), eq(teams.status, disabled ? "active" : "disabled")))
    .returning({ id: teams.id });
  const updated = db
    .select({ value: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.status, status), eq(teams.updatedAt, now)));
  const result = await db.batch([
    changed,
    applicationsForTeamAuthzVersionStatement(db, teamId, now),
    auditStatementWhen(
      db,
      `team:${disabled ? "disabled" : "enabled"}:${teamId}:${now}`,
      `team.${disabled ? "disabled" : "enabled"}`,
      actor.principalId,
      null,
      null,
      { id: teamId, status },
      now,
      updated,
    ),
    outboxStatementWhen(
      db,
      `team:${disabled ? "disabled" : "enabled"}:outbox:${teamId}:${now}`,
      `team.${disabled ? "disabled" : "enabled"}`,
      "team",
      teamId,
      { id: teamId, status },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return { id: teamId, status: status as "active" | "disabled" };
}

export async function deleteTeam(
  environment: AuthEnvironment,
  actor: Actor,
  teamId: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "team-delete", 30, 60);
  const db = createDb(environment.DB);
  const team = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).get();
  if (!team) throw new ApiError(404);
  await assertNoOwnedServiceAccounts(db, teamId);
  await assertNoOwnedApplications(db, teamId);
  const now = Date.now();
  const deleted = db.delete(teams).where(eq(teams.id, teamId)).returning({ id: teams.id });
  const result = await db.batch([
    applicationsForTeamAuthzVersionStatement(db, teamId, now),
    deleted,
    auditStatement(
      db,
      `team:deleted:${teamId}:${now}`,
      "team.deleted",
      actor.principalId,
      null,
      null,
      { id: teamId },
      now,
    ),
    outboxStatement(
      db,
      `team:deleted:outbox:${teamId}:${now}`,
      "team.deleted",
      "team",
      teamId,
      { id: teamId },
      now,
    ),
  ]);
  if (!result[1]?.length) throw new ApiError(409);
  return { id: teamId, status: "deleted" as const };
}

export async function addTeamMember(
  environment: AuthEnvironment,
  actor: Actor,
  teamId: string,
  identifier: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "team-member-add", 120, 60);
  const db = createDb(environment.DB);
  const team = await db
    .select({ id: teams.id, status: teams.status })
    .from(teams)
    .where(eq(teams.id, teamId))
    .get();
  if (!team || team.status !== "active") throw new ApiError(404);
  const human = await resolveHumanPrincipal(db, identifier);
  if (!human || human.principal_status !== "active" || human.human_status !== "active") {
    throw new ApiError(409);
  }
  const now = Date.now();
  const membershipId = `membership_${crypto.randomUUID()}`;
  const inserted = db
    .insert(teamMemberships)
    .values({
      id: membershipId,
      teamId,
      userPrincipalId: human.principal_id,
      addedByPrincipalId: actor.principalId,
      createdAt: now,
    })
    .onConflictDoNothing({ target: [teamMemberships.teamId, teamMemberships.userPrincipalId] })
    .returning({ id: teamMemberships.id });
  const membership = db
    .select({ value: teamMemberships.id })
    .from(teamMemberships)
    .where(eq(teamMemberships.id, membershipId));
  const result = await db.batch([
    inserted,
    applicationsForTeamAuthzVersionStatement(db, teamId, now),
    auditStatementWhen(
      db,
      `team-member:added:${teamId}:${human.principal_id}:${now}`,
      "team.member_added",
      actor.principalId,
      human.principal_id,
      human.user_id,
      { teamId },
      now,
      membership,
    ),
    outboxStatementWhen(
      db,
      `team-member:added:outbox:${teamId}:${human.principal_id}:${now}`,
      "team.member_added",
      "team",
      teamId,
      { teamId, principalId: human.principal_id, userId: human.user_id },
      now,
      membership,
    ),
  ]);
  if (!result[0]?.length) {
    return { principalId: human.principal_id, status: "member" as const, teamId };
  }
  return { principalId: human.principal_id, status: "member" as const, teamId };
}

export async function removeTeamMember(
  environment: AuthEnvironment,
  actor: Actor,
  teamId: string,
  identifier: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "team-member-remove", 120, 60);
  const db = createDb(environment.DB);
  const human = await resolveHumanPrincipal(db, identifier);
  if (!human) throw new ApiError(404);
  const membership = await db
    .select({ id: teamMemberships.id })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userPrincipalId, human.principal_id),
      ),
    )
    .get();
  if (!membership) throw new ApiError(404);
  const now = Date.now();
  const deleted = db
    .delete(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userPrincipalId, human.principal_id),
      ),
    )
    .returning({ id: teamMemberships.id });
  const result = await db.batch([
    deleted,
    applicationsForTeamAuthzVersionStatement(db, teamId, now),
    auditStatement(
      db,
      `team-member:removed:${teamId}:${human.principal_id}:${now}`,
      "team.member_removed",
      actor.principalId,
      human.principal_id,
      human.user_id,
      { teamId },
      now,
    ),
    outboxStatement(
      db,
      `team-member:removed:outbox:${teamId}:${human.principal_id}:${now}`,
      "team.member_removed",
      "team",
      teamId,
      { teamId, principalId: human.principal_id, userId: human.user_id },
      now,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(404);
  return { principalId: human.principal_id, status: "removed" as const, teamId };
}

async function assertNoOwnedServiceAccounts(database: ReturnType<typeof createDb>, teamId: string) {
  const owned = await database
    .select({ id: serviceAccounts.principalId })
    .from(serviceAccounts)
    .where(eq(serviceAccounts.ownerTeamId, teamId))
    .get();
  if (owned) throw new ApiError(409);
}

async function assertNoOwnedApplications(database: ReturnType<typeof createDb>, teamId: string) {
  const owned = await database
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.ownerTeamId, teamId))
    .get();
  if (owned) throw new ApiError(409);
}
