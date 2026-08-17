import { and, asc, eq, inArray } from "drizzle-orm";
import { APIError } from "better-auth/api";

import { oauthClientResource } from "../../../db/auth-schema";
import { createDb, type AppDb } from "../../../db";
import {
  applicationOauthClients,
  applicationResources,
  applicationRoles,
  applications,
  humanPrincipals,
  principals,
  serviceAccountApplicationAssignments,
  serviceAccountApplicationRoleGrants,
  serviceAccountOauthClients,
  serviceAccounts,
  teamApplicationAssignments,
  teamApplicationRoleGrants,
  teamMemberships,
  teams,
  userApplicationAssignments,
  userApplicationRoleGrants,
} from "../../../db/domain-schema";
import { type AuthEnvironment } from "../../auth";

type ClaimInput = {
  clientId: string;
  userId?: string | null;
  resources?: string[];
  requireTargetResource: boolean;
};

type PrincipalClaims = {
  principalId: string;
  principalType: "user" | "service-account";
  roles: string[];
  teams: string[];
};

export function getShuiClaimNamespace(environment: Pick<AuthEnvironment, "BETTER_AUTH_URL">) {
  return `${new URL(environment.BETTER_AUTH_URL).origin}/claims/`;
}

function throwOAuthError(error: string, description: string): never {
  throw new APIError("BAD_REQUEST", {
    error,
    error_description: description,
  });
}

async function readManagedClient(database: AppDb, clientId: string) {
  const [humanClient, serviceClient] = await Promise.all([
    database
      .select({
        applicationId: applicationOauthClients.applicationId,
      })
      .from(applicationOauthClients)
      .where(eq(applicationOauthClients.clientId, clientId))
      .get(),
    database
      .select({
        applicationId: serviceAccountOauthClients.applicationId,
        serviceAccountPrincipalId: serviceAccountOauthClients.serviceAccountPrincipalId,
      })
      .from(serviceAccountOauthClients)
      .where(eq(serviceAccountOauthClients.clientId, clientId))
      .get(),
  ]);

  if (humanClient && serviceClient) {
    throwOAuthError("invalid_client", "The OAuth client has multiple Shui owners.");
  }

  const mapping = humanClient
    ? { applicationId: humanClient.applicationId, kind: "human" as const }
    : serviceClient
      ? {
          applicationId: serviceClient.applicationId,
          kind: "service" as const,
          serviceAccountPrincipalId: serviceClient.serviceAccountPrincipalId,
        }
      : null;
  if (!mapping) return null;

  const application = await database
    .select({
      status: applications.status,
      authzVersion: applications.authzVersion,
      resourceIdentifier: applicationResources.resourceIdentifier,
    })
    .from(applications)
    .innerJoin(applicationResources, eq(applicationResources.applicationId, applications.id))
    .where(eq(applications.id, mapping.applicationId))
    .get();
  if (!application) throwOAuthError("invalid_target", "The Application resource is missing.");

  const resources = await database
    .select({ resourceId: oauthClientResource.resourceId })
    .from(oauthClientResource)
    .where(eq(oauthClientResource.clientId, clientId))
    .all();
  if (resources.length !== 1 || resources[0]?.resourceId !== application.resourceIdentifier) {
    throwOAuthError(
      "invalid_target",
      "The OAuth client must have exactly one Application resource.",
    );
  }

  return {
    applicationId: mapping.applicationId,
    authzVersion: Number(application.authzVersion ?? 1),
    kind: mapping.kind,
    resourceIdentifier: application.resourceIdentifier,
    serviceAccountPrincipalId: mapping.serviceAccountPrincipalId,
    status: application.status,
  };
}

function assertTargetResource(
  resources: string[] | undefined,
  resourceIdentifier: string,
  requireTargetResource: boolean,
) {
  if (
    requireTargetResource &&
    (!resources || resources.length !== 1 || resources[0] !== resourceIdentifier)
  ) {
    throwOAuthError("invalid_target", "An Access Token must target exactly one Application.");
  }
  if (resources && !resources.includes(resourceIdentifier)) {
    throwOAuthError("invalid_target", "The OAuth request does not target this Application.");
  }
}

async function readHumanClaims(
  database: AppDb,
  applicationId: string,
  userId: string | null | undefined,
): Promise<PrincipalClaims> {
  if (!userId) throwOAuthError("invalid_grant", "A human principal is required.");

  const principal = await database
    .select({
      principalId: humanPrincipals.principalId,
      principalStatus: principals.status,
      humanStatus: humanPrincipals.status,
      disabled: humanPrincipals.disabled,
    })
    .from(humanPrincipals)
    .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .where(
      and(
        eq(humanPrincipals.userId, userId),
        eq(principals.type, "human"),
        eq(principals.status, "active"),
        eq(humanPrincipals.status, "active"),
        eq(humanPrincipals.disabled, false),
      ),
    )
    .get();
  if (!principal || principal.principalStatus !== "active" || principal.humanStatus !== "active") {
    throwOAuthError("invalid_grant", "The human principal is disabled.");
  }

  const [directAssignment, memberships, directRoles] = await Promise.all([
    database
      .select({ id: userApplicationAssignments.id })
      .from(userApplicationAssignments)
      .where(
        and(
          eq(userApplicationAssignments.applicationId, applicationId),
          eq(userApplicationAssignments.userPrincipalId, principal.principalId),
          eq(userApplicationAssignments.status, "active"),
        ),
      )
      .get(),
    database
      .select({ teamId: teamMemberships.teamId })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .where(
        and(eq(teamMemberships.userPrincipalId, principal.principalId), eq(teams.status, "active")),
      )
      .all(),
    database
      .select({ roleKey: applicationRoles.key })
      .from(userApplicationRoleGrants)
      .innerJoin(applicationRoles, eq(applicationRoles.id, userApplicationRoleGrants.roleId))
      .where(
        and(
          eq(userApplicationRoleGrants.applicationId, applicationId),
          eq(userApplicationRoleGrants.userPrincipalId, principal.principalId),
          eq(applicationRoles.applicationId, applicationId),
          eq(applicationRoles.status, "active"),
        ),
      )
      .all(),
  ]);

  const teamIds = memberships.map((membership) => membership.teamId);
  const [teamAssignments, teamRoles] = await Promise.all([
    teamIds.length
      ? database
          .select({ teamId: teamApplicationAssignments.teamId })
          .from(teamApplicationAssignments)
          .where(
            and(
              eq(teamApplicationAssignments.applicationId, applicationId),
              eq(teamApplicationAssignments.status, "active"),
              inArray(teamApplicationAssignments.teamId, teamIds),
            ),
          )
          .all()
      : Promise.resolve([]),
    teamIds.length
      ? database
          .select({ teamId: teamApplicationRoleGrants.teamId, roleKey: applicationRoles.key })
          .from(teamApplicationRoleGrants)
          .innerJoin(applicationRoles, eq(applicationRoles.id, teamApplicationRoleGrants.roleId))
          .where(
            and(
              eq(teamApplicationRoleGrants.applicationId, applicationId),
              eq(applicationRoles.applicationId, applicationId),
              eq(applicationRoles.status, "active"),
              inArray(teamApplicationRoleGrants.teamId, teamIds),
            ),
          )
          .all()
      : Promise.resolve([]),
  ]);

  if (!directAssignment && teamAssignments.length === 0) {
    throwOAuthError("invalid_grant", "The principal is not assigned to this Application.");
  }

  const roles = Array.from(
    new Set([...directRoles.map((role) => role.roleKey), ...teamRoles.map((role) => role.roleKey)]),
  ).sort();
  const relevantTeamIds = new Set([
    ...teamAssignments.map((assignment) => assignment.teamId),
    ...teamRoles.map((role) => role.teamId),
  ]);

  return {
    principalId: principal.principalId,
    principalType: "user",
    roles,
    teams: Array.from(relevantTeamIds).sort(),
  };
}

async function readServiceAccountClaims(
  database: AppDb,
  applicationId: string,
  serviceAccountPrincipalId: string,
): Promise<PrincipalClaims> {
  const principal = await database
    .select({
      principalId: principals.id,
      principalType: principals.type,
      principalStatus: principals.status,
    })
    .from(principals)
    .innerJoin(serviceAccounts, eq(serviceAccounts.principalId, principals.id))
    .where(and(eq(principals.id, serviceAccountPrincipalId), eq(principals.type, "service")))
    .get();
  if (!principal || principal.principalType !== "service") {
    throwOAuthError("invalid_client", "The Service Account does not exist.");
  }
  if (principal.principalStatus !== "active") {
    throwOAuthError("invalid_client", "The Service Account is disabled.");
  }

  const assignment = await database
    .select({ id: serviceAccountApplicationAssignments.id })
    .from(serviceAccountApplicationAssignments)
    .where(
      and(
        eq(serviceAccountApplicationAssignments.applicationId, applicationId),
        eq(
          serviceAccountApplicationAssignments.serviceAccountPrincipalId,
          serviceAccountPrincipalId,
        ),
        eq(serviceAccountApplicationAssignments.status, "active"),
      ),
    )
    .get();
  if (!assignment) {
    throwOAuthError("invalid_grant", "The Service Account is not assigned to this Application.");
  }

  const roles = await database
    .select({ roleKey: applicationRoles.key })
    .from(serviceAccountApplicationRoleGrants)
    .innerJoin(
      applicationRoles,
      eq(applicationRoles.id, serviceAccountApplicationRoleGrants.roleId),
    )
    .where(
      and(
        eq(serviceAccountApplicationRoleGrants.applicationId, applicationId),
        eq(
          serviceAccountApplicationRoleGrants.serviceAccountPrincipalId,
          serviceAccountPrincipalId,
        ),
        eq(applicationRoles.applicationId, applicationId),
        eq(applicationRoles.status, "active"),
      ),
    )
    .orderBy(asc(applicationRoles.key))
    .all();

  return {
    principalId: serviceAccountPrincipalId,
    principalType: "service-account",
    roles: Array.from(new Set(roles.map((role) => role.roleKey))).sort(),
    teams: [],
  };
}

export async function resolveShuiClaims(
  environment: Pick<AuthEnvironment, "BETTER_AUTH_URL" | "DB">,
  input: ClaimInput,
) {
  const database = createDb(environment.DB);
  const managedClient = await readManagedClient(database, input.clientId);
  if (!managedClient) return {};

  assertTargetResource(
    input.resources,
    managedClient.resourceIdentifier,
    input.requireTargetResource,
  );
  if (managedClient.status !== "active") {
    throwOAuthError("invalid_target", "The Application is disabled.");
  }

  const principal =
    managedClient.kind === "human"
      ? await readHumanClaims(database, managedClient.applicationId, input.userId)
      : await readServiceAccountClaims(
          database,
          managedClient.applicationId,
          managedClient.serviceAccountPrincipalId ?? "",
        );
  const namespace = getShuiClaimNamespace(environment);
  return {
    [`${namespace}application_id`]: managedClient.applicationId,
    [`${namespace}principal_id`]: principal.principalId,
    [`${namespace}principal_type`]: principal.principalType,
    [`${namespace}roles`]: principal.roles,
    [`${namespace}teams`]: principal.teams,
    [`${namespace}authz_version`]: managedClient.authzVersion,
  };
}

export function audienceResources(audience: unknown) {
  if (typeof audience === "string") return [audience];
  if (Array.isArray(audience))
    return audience.filter((value): value is string => typeof value === "string");
  return undefined;
}
