import { lt, sql, type SQLWrapper } from "drizzle-orm";

import { createDb, type AppDb } from "../../db";
import { auditEvents, outboxEvents, rateLimitBuckets } from "../../db/domain-schema";
import { type AuthEnvironment } from "../auth";
import { M1Error } from "../modules/errors";

export type BootstrapState = {
  status: "uninitialized" | "reserved" | "user-created" | "completed";
  reservation_id: string | null;
  email: string | null;
  user_id: string | null;
  principal_id: string | null;
  reserved_at: number | null;
};

export type InvitationStatus = "pending" | "claimed" | "completed" | "revoked" | "expired";

export type Invitation = {
  id: string;
  token_hash: string;
  email: string;
  name: string | null;
  status: InvitationStatus;
  expires_at: number;
  invited_by_principal_id: string;
  claimed_user_id: string | null;
  claimed_principal_id: string | null;
  system_role_keys: string;
  claimed_at: number | null;
};

export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
};

export function normalizeEmail(email: string) {
  return email.normalize("NFKC").trim().toLowerCase();
}

export function normalizeName(name: string | undefined, fallback: string) {
  const value = name?.normalize("NFKC").trim() || fallback;
  if (!value) throw new M1Error(400);
  return value;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256Bytes(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function sha256Base64Url(value: string) {
  return toBase64Url(await sha256Bytes(value));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

function isStrongBootstrapToken(token: string | undefined): token is string {
  return Boolean(token && token.length >= 32 && new Set(token).size >= 12);
}

export async function validateBootstrapToken(environment: AuthEnvironment, suppliedToken: string) {
  const configuredToken = environment.BOOTSTRAP_TOKEN;
  const expectedToken = isStrongBootstrapToken(configuredToken)
    ? configuredToken
    : "bootstrap-token-not-configured";
  const [suppliedHash, expectedHash] = await Promise.all([
    sha256Bytes(suppliedToken),
    sha256Bytes(expectedToken),
  ]);

  return isStrongBootstrapToken(configuredToken) && constantTimeEqual(suppliedHash, expectedHash);
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function requestAddress(request: Request) {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareAddress) return cloudflareAddress;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.url.startsWith("http://localhost") || request.url.startsWith("http://127.0.0.1")
    ? forwarded || "local"
    : "unknown";
}

async function consumeM1RateLimit(
  database: D1Database,
  key: string,
  max: number,
  windowSeconds: number,
) {
  const bucket = await consumeRateLimitBucket(database, key, windowSeconds);

  if (!bucket) throw new M1Error(500);

  return bucket.count <= max;
}

export async function consumeRateLimitBucket(
  database: D1Database,
  key: string,
  windowSeconds: number,
) {
  const db = createDb(database);
  const now = Date.now();
  const windowMilliseconds = windowSeconds * 1000;
  const bucketQuery = db
    .insert(rateLimitBuckets)
    .values({
      bucketKey: key,
      windowStartedAt: now,
      count: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: rateLimitBuckets.bucketKey,
      set: {
        count: sql<number>`CASE
          WHEN ${rateLimitBuckets.windowStartedAt} + ${windowMilliseconds} <= ${now}
          THEN 1
          ELSE ${rateLimitBuckets.count} + 1
        END`,
        windowStartedAt: sql<number>`CASE
          WHEN ${rateLimitBuckets.windowStartedAt} + ${windowMilliseconds} <= ${now}
          THEN ${now}
          ELSE ${rateLimitBuckets.windowStartedAt}
        END`,
        updatedAt: now,
      },
    });
  const bucket = await bucketQuery
    .returning({
      count: rateLimitBuckets.count,
      windowStartedAt: rateLimitBuckets.windowStartedAt,
    })
    .get();

  if (bucket?.count === 1) {
    await db
      .delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.updatedAt, now - 24 * 60 * 60 * 1000))
      .run();
  }

  return bucket;
}

export async function enforceRateLimit(
  environment: AuthEnvironment,
  request: Request,
  bucket: string,
  max: number,
  windowSeconds: number,
) {
  const allowed = await consumeM1RateLimit(
    environment.DB,
    `m1:${bucket}:${requestAddress(request)}`,
    max,
    windowSeconds,
  );
  if (!allowed) throw new M1Error(429);
}

export function auditStatement(
  database: AppDb,
  id: string,
  eventType: string,
  actorPrincipalId: string | null,
  subjectPrincipalId: string | null,
  subjectUserId: string | null,
  metadata: Record<string, unknown>,
  createdAt: number,
) {
  return database
    .insert(auditEvents)
    .values({
      id,
      eventType,
      actorPrincipalId,
      subjectPrincipalId,
      subjectUserId,
      metadata: JSON.stringify(metadata),
      createdAt,
    })
    .onConflictDoNothing({ target: auditEvents.id });
}

export function outboxStatement(
  database: AppDb,
  id: string,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  createdAt: number,
) {
  return database
    .insert(outboxEvents)
    .values({
      id,
      dedupeKey: id,
      eventType,
      aggregateType,
      aggregateId,
      payload: JSON.stringify(payload),
      status: "pending",
      attempts: 0,
      availableAt: createdAt,
      createdAt,
    })
    .onConflictDoNothing({ target: outboxEvents.dedupeKey });
}

export function auditStatementWhen(
  database: AppDb,
  id: string,
  eventType: string,
  actorPrincipalId: string | null | SQLWrapper,
  subjectPrincipalId: string | null | SQLWrapper,
  subjectUserId: string | null | SQLWrapper,
  metadata: Record<string, unknown>,
  createdAt: number,
  condition: SQLWrapper,
) {
  const query = database
    .insert(auditEvents)
    .select(
      sql`SELECT
        ${id},
        ${eventType},
        ${actorPrincipalId},
        ${subjectPrincipalId},
        ${subjectUserId},
        ${JSON.stringify(metadata)},
        ${createdAt}
       WHERE EXISTS ${condition}`,
    )
    .onConflictDoNothing({ target: auditEvents.id });
  return query;
}

export function outboxStatementWhen(
  database: AppDb,
  id: string,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  createdAt: number,
  condition: SQLWrapper,
) {
  const query = database
    .insert(outboxEvents)
    .select(
      sql`SELECT
        ${id},
        ${id},
        ${eventType},
        ${aggregateType},
        ${aggregateId},
        ${JSON.stringify(payload)},
        'pending',
        0,
        ${createdAt},
        NULL,
        NULL,
        ${createdAt}
       WHERE EXISTS ${condition}`,
    )
    .onConflictDoNothing({ target: outboxEvents.dedupeKey });
  return query;
}
