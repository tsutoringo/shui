import { and, asc, eq } from "drizzle-orm";

import { oauthClient, oauthClientResource } from "../../../db/auth-schema";
import { createDb, type AppDb } from "../../../db";
import {
  applicationResources,
  applications,
  principals,
  serviceAccountOauthClients,
  serviceAccounts,
} from "../../../db/domain-schema";
import { type AuthEnvironment } from "../../auth";
import { applicationAuthzVersionStatement } from "../applications/service";
import { type Actor } from "../authorization/service";
import { ApiError } from "../errors";
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
  ServiceAccountCredential,
  ServiceAccountCredentialCreateBody,
  ServiceAccountCredentialRotateBody,
} from "./models";

const SERVICE_ACCOUNT_SCOPES = ["api:read"] as const;

function normalizeName(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > 160) throw new ApiError(400);
  return normalized;
}

function timestamp(value: Date | number | null | undefined) {
  return value instanceof Date ? value.getTime() : Number(value ?? 0);
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

async function readServiceAccount(database: AppDb, principalId: string) {
  const row = await database
    .select({
      principalId: serviceAccounts.principalId,
      status: principals.status,
      name: serviceAccounts.name,
    })
    .from(serviceAccounts)
    .innerJoin(principals, eq(principals.id, serviceAccounts.principalId))
    .where(and(eq(serviceAccounts.principalId, principalId), eq(principals.type, "service")))
    .get();
  if (!row) throw new ApiError(404);
  return row;
}

async function readActiveApplication(database: AppDb, applicationId: string) {
  const row = await database
    .select({
      id: applications.id,
      name: applications.name,
      status: applications.status,
      resourceIdentifier: applicationResources.resourceIdentifier,
    })
    .from(applications)
    .innerJoin(applicationResources, eq(applicationResources.applicationId, applications.id))
    .where(eq(applications.id, applicationId))
    .get();
  if (!row) throw new ApiError(404);
  if (row.status !== "active") throw new ApiError(409);
  return row;
}

async function readCredential(database: AppDb, serviceAccountId: string, clientId: string) {
  const row = await database
    .select({
      serviceAccountId: serviceAccountOauthClients.serviceAccountPrincipalId,
      applicationId: serviceAccountOauthClients.applicationId,
      applicationName: applications.name,
      resourceIdentifier: applicationResources.resourceIdentifier,
      clientId: oauthClient.clientId,
      name: oauthClient.name,
      scopes: oauthClient.scopes,
      disabled: oauthClient.disabled,
      createdAt: oauthClient.createdAt,
      updatedAt: oauthClient.updatedAt,
    })
    .from(serviceAccountOauthClients)
    .innerJoin(oauthClient, eq(oauthClient.clientId, serviceAccountOauthClients.clientId))
    .innerJoin(applications, eq(applications.id, serviceAccountOauthClients.applicationId))
    .innerJoin(
      applicationResources,
      eq(applicationResources.applicationId, serviceAccountOauthClients.applicationId),
    )
    .where(
      and(
        eq(serviceAccountOauthClients.serviceAccountPrincipalId, serviceAccountId),
        eq(serviceAccountOauthClients.clientId, clientId),
      ),
    )
    .get();
  if (!row) throw new ApiError(404);

  const resources = await database
    .select({ resourceId: oauthClientResource.resourceId })
    .from(oauthClientResource)
    .where(eq(oauthClientResource.clientId, clientId))
    .all();
  if (resources.length !== 1 || resources[0]?.resourceId !== row.resourceIdentifier) {
    throw new ApiError(409);
  }

  return {
    serviceAccountId: row.serviceAccountId,
    applicationId: row.applicationId,
    applicationName: row.applicationName,
    resourceIdentifier: row.resourceIdentifier,
    clientId: row.clientId,
    name: row.name ?? row.clientId,
    scopes: parseStringArray(row.scopes),
    disabled: Boolean(row.disabled),
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  } satisfies ServiceAccountCredential;
}

async function insertCredential(
  database: AppDb,
  actor: Actor,
  serviceAccountId: string,
  applicationId: string,
  resourceIdentifier: string,
  name: string,
  requestKind: "created" | "rotated",
  rotatedFromClientId?: string,
) {
  const clientId = `client_${crypto.randomUUID()}`;
  const clientSecret = randomToken();
  const now = Date.now();
  const clientSecretHash = await sha256Base64Url(clientSecret);

  await database.batch([
    database.insert(oauthClient).values({
      id: crypto.randomUUID(),
      clientId,
      clientSecret: clientSecretHash,
      clientDiscoveryId: null,
      disabled: false,
      skipConsent: true,
      enableEndSession: false,
      subjectType: "public",
      scopes: [...SERVICE_ACCOUNT_SCOPES],
      clientCredentialsScopes: [...SERVICE_ACCOUNT_SCOPES],
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
      redirectUris: [],
      postLogoutRedirectUris: null,
      backchannelLogoutUri: null,
      backchannelLogoutSessionRequired: false,
      tokenEndpointAuthMethod: "client_secret_basic",
      applicationType: "web",
      jwks: null,
      jwksUri: null,
      grantTypes: ["client_credentials"],
      responseTypes: [],
      requirePKCE: false,
      dpopBoundAccessTokens: false,
      referenceId: null,
      metadata: null,
    }),
    database.insert(oauthClientResource).values({
      id: crypto.randomUUID(),
      clientId,
      resourceId: resourceIdentifier,
      metadata: null,
      createdAt: new Date(now),
    }),
    database.insert(serviceAccountOauthClients).values({
      clientId,
      applicationId,
      serviceAccountPrincipalId: serviceAccountId,
      createdAt: now,
      updatedAt: now,
    }),
    applicationAuthzVersionStatement(database, applicationId, now),
    auditStatement(
      database,
      `service-account-credential:${requestKind}:${clientId}`,
      `service_account_credential.${requestKind}`,
      actor.principalId,
      serviceAccountId,
      null,
      {
        applicationId,
        clientId,
        rotatedFromClientId: rotatedFromClientId ?? null,
      },
      now,
    ),
    outboxStatement(
      database,
      `service-account-credential:${requestKind}:outbox:${clientId}`,
      `service_account_credential.${requestKind}`,
      "service_account",
      serviceAccountId,
      { applicationId, clientId, rotatedFromClientId: rotatedFromClientId ?? null },
      now,
    ),
  ]);

  return { clientId, clientSecret };
}

export async function listServiceAccountCredentials(
  environment: AuthEnvironment,
  serviceAccountId: string,
) {
  const database = createDb(environment.DB);
  await readServiceAccount(database, serviceAccountId);
  const rows = await database
    .select({ clientId: serviceAccountOauthClients.clientId })
    .from(serviceAccountOauthClients)
    .where(eq(serviceAccountOauthClients.serviceAccountPrincipalId, serviceAccountId))
    .orderBy(asc(serviceAccountOauthClients.createdAt))
    .all();
  return Promise.all(rows.map((row) => readCredential(database, serviceAccountId, row.clientId)));
}

export async function createServiceAccountCredential(
  environment: AuthEnvironment,
  actor: Actor,
  serviceAccountId: string,
  body: ServiceAccountCredentialCreateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "service-account-credential-create", 60, 60);
  const database = createDb(environment.DB);
  const serviceAccount = await readServiceAccount(database, serviceAccountId);
  if (serviceAccount.status !== "active") throw new ApiError(409);
  const application = await readActiveApplication(database, body.applicationId);
  const name = normalizeName(body.name);
  const credential = await insertCredential(
    database,
    actor,
    serviceAccountId,
    application.id,
    application.resourceIdentifier,
    name,
    "created",
  );
  return {
    ...(await readCredential(database, serviceAccountId, credential.clientId)),
    clientSecret: credential.clientSecret,
  };
}

export async function rotateServiceAccountCredential(
  environment: AuthEnvironment,
  actor: Actor,
  serviceAccountId: string,
  clientId: string,
  body: ServiceAccountCredentialRotateBody,
  request: Request,
) {
  await enforceRateLimit(environment, request, "service-account-credential-rotate", 60, 60);
  const database = createDb(environment.DB);
  const serviceAccount = await readServiceAccount(database, serviceAccountId);
  if (serviceAccount.status !== "active") throw new ApiError(409);
  const current = await readCredential(database, serviceAccountId, clientId);
  const application = await readActiveApplication(database, current.applicationId);
  const name = normalizeName(body.name ?? current.name);
  const credential = await insertCredential(
    database,
    actor,
    serviceAccountId,
    application.id,
    application.resourceIdentifier,
    name,
    "rotated",
    current.clientId,
  );
  return {
    ...(await readCredential(database, serviceAccountId, credential.clientId)),
    clientSecret: credential.clientSecret,
  };
}

export async function setServiceAccountCredentialDisabled(
  environment: AuthEnvironment,
  actor: Actor,
  serviceAccountId: string,
  clientId: string,
  disabled: boolean,
  request: Request,
) {
  await enforceRateLimit(
    environment,
    request,
    disabled ? "service-account-credential-disable" : "service-account-credential-enable",
    60,
    60,
  );
  const database = createDb(environment.DB);
  const current = await readCredential(database, serviceAccountId, clientId);
  if (current.disabled === disabled) return current;
  const serviceAccount = await readServiceAccount(database, serviceAccountId);
  if (!disabled && serviceAccount.status !== "active") throw new ApiError(409);
  if (!disabled) await readActiveApplication(database, current.applicationId);

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
    applicationAuthzVersionStatement(database, current.applicationId, now),
    auditStatementWhen(
      database,
      `service-account-credential:${disabled ? "disabled" : "enabled"}:${clientId}:${now}`,
      `service_account_credential.${disabled ? "disabled" : "enabled"}`,
      actor.principalId,
      serviceAccountId,
      null,
      { applicationId: current.applicationId, clientId, disabled },
      now,
      updated,
    ),
    outboxStatementWhen(
      database,
      `service-account-credential:${disabled ? "disabled" : "enabled"}:outbox:${clientId}:${now}`,
      `service_account_credential.${disabled ? "disabled" : "enabled"}`,
      "service_account",
      serviceAccountId,
      { applicationId: current.applicationId, clientId, disabled },
      now,
      updated,
    ),
  ]);
  if (!result[0]?.length) throw new ApiError(409);
  return readCredential(database, serviceAccountId, clientId);
}

export async function deleteServiceAccountCredential(
  environment: AuthEnvironment,
  actor: Actor,
  serviceAccountId: string,
  clientId: string,
  request: Request,
) {
  await enforceRateLimit(environment, request, "service-account-credential-delete", 30, 60);
  const database = createDb(environment.DB);
  const current = await readCredential(database, serviceAccountId, clientId);
  const now = Date.now();
  await database.batch([
    database
      .delete(serviceAccountOauthClients)
      .where(
        and(
          eq(serviceAccountOauthClients.serviceAccountPrincipalId, serviceAccountId),
          eq(serviceAccountOauthClients.clientId, clientId),
        ),
      ),
    database.delete(oauthClient).where(eq(oauthClient.clientId, clientId)),
    applicationAuthzVersionStatement(database, current.applicationId, now),
    auditStatement(
      database,
      `service-account-credential:deleted:${clientId}:${now}`,
      "service_account_credential.deleted",
      actor.principalId,
      serviceAccountId,
      null,
      { applicationId: current.applicationId, clientId },
      now,
    ),
    outboxStatement(
      database,
      `service-account-credential:deleted:outbox:${clientId}:${now}`,
      "service_account_credential.deleted",
      "service_account",
      serviceAccountId,
      { applicationId: current.applicationId, clientId },
      now,
    ),
  ]);
  return { clientId, status: "deleted" as const };
}
