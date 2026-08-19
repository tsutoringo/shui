import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth/minimal";
import { jwt } from "better-auth/plugins/jwt";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../db";
import * as authSchema from "../db/auth-schema";
import { auditEvents, humanPrincipals, principals } from "../db/domain-schema";
import { audienceResources, resolveShuiClaims } from "./modules/applications/claims";
import { createOAuthConsentAccessPlugin } from "./modules/applications/consent";
import { consumeRateLimitBucket } from "./shared/infrastructure";
import { env } from "cloudflare:workers";

export type DevelopmentEmailKind = "invitation" | "password-reset" | "verification";

export interface DevelopmentEmailMessage {
  kind: DevelopmentEmailKind;
  email: string;
  token: string;
  url: string;
}

export const PASSWORD_RESET_TIMING_FLOOR_MS = 250;

const developmentEmailSink: DevelopmentEmailMessage[] = [];

export interface AuthEnvironment {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BOOTSTRAP_TOKEN: string;
  DEV_EMAIL_SINK?: string;
  EMAIL_WEBHOOK_URL?: string;
}

export function readDevelopmentEmailSink(): readonly DevelopmentEmailMessage[] {
  return developmentEmailSink.slice();
}

export function clearDevelopmentEmailSink() {
  developmentEmailSink.length = 0;
}

export function recordDevelopmentEmail(
  environment: Pick<AuthEnvironment, "BETTER_AUTH_URL" | "DEV_EMAIL_SINK">,
  message: DevelopmentEmailMessage,
) {
  if (!isLocalEnvironment(environment)) return;

  developmentEmailSink.push(message);
  if (developmentEmailSink.length > 100) developmentEmailSink.shift();
}

export function isLocalEnvironment(
  environment: Pick<AuthEnvironment, "BETTER_AUTH_URL" | "DEV_EMAIL_SINK">,
) {
  return (
    environment.DEV_EMAIL_SINK === "true" &&
    (environment.BETTER_AUTH_URL.startsWith("http://localhost") ||
      environment.BETTER_AUTH_URL.startsWith("http://127.0.0.1"))
  );
}

export async function deliverEmail(
  environment: Pick<AuthEnvironment, "BETTER_AUTH_URL" | "DEV_EMAIL_SINK" | "EMAIL_WEBHOOK_URL">,
  message: DevelopmentEmailMessage,
) {
  if (isLocalEnvironment(environment)) {
    recordDevelopmentEmail(environment, message);
    return;
  }

  if (!environment.EMAIL_WEBHOOK_URL) {
    throw new Error("Transactional email delivery is not configured.");
  }

  const response = await fetch(environment.EMAIL_WEBHOOK_URL, {
    body: JSON.stringify(message),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) throw new Error(`Transactional email delivery failed: ${response.status}`);
}

export function createAuth(environment: AuthEnvironment) {
  const resourceIdentifier = `${environment.BETTER_AUTH_URL}/api`;
  const db = createDb(environment.DB);

  return betterAuth({
    appName: "Shui",
    basePath: "/api/auth",
    baseURL: environment.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
      transaction: false,
    }),
    disabledPaths: ["/token"],
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      disableSignUp: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        await deliverEmail(environment, {
          email: user.email,
          kind: "password-reset",
          token,
          url,
        });
        await recordAuthAudit(db, "auth.password_reset_requested", user.id, {});
      },
    },
    emailVerification: {
      autoSignInAfterVerification: false,
      sendOnSignIn: false,
      sendOnSignUp: false,
      sendVerificationEmail: async ({ user, url, token }) => {
        await deliverEmail(environment, {
          email: user.email,
          kind: "verification",
          token,
          url,
        });
        await recordAuthAudit(db, "auth.verification_sent", user.id, {});
      },
    },
    plugins: [
      jwt({
        jwks: {
          keyPairConfig: {
            alg: "RS256",
          },
        },
      }),
      oauthProvider({
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
        clientRegistrationAllowedResources: [resourceIdentifier],
        clientRegistrationDefaultResources: [resourceIdentifier],
        consentPage: "/consent",
        enforcePerClientResources: true,
        grantTypes: ["authorization_code", "client_credentials"],
        loginPage: "/sign-in",
        resources: [
          {
            accessTokenTtl: 3600,
            allowedScopes: ["openid", "profile", "email", "api:read"],
            identifier: resourceIdentifier,
            name: "Shui API",
          },
        ],
        scopes: ["openid", "profile", "email", "api:read"],
        extensions: [
          {
            claims: {
              accessToken: async ({ client, resources, user }) =>
                resolveShuiClaims(environment, {
                  clientId: client.clientId,
                  requireTargetResource: true,
                  resources,
                  userId: user?.id,
                }),
              idToken: async ({ client, resources, user }) =>
                resolveShuiClaims(environment, {
                  clientId: client.clientId,
                  requireTargetResource: false,
                  resources,
                  userId: user?.id,
                }),
              userInfo: async ({ client, jwt, user }) =>
                client
                  ? resolveShuiClaims(environment, {
                      clientId: client.clientId,
                      requireTargetResource: false,
                      resources: audienceResources(jwt.aud),
                      userId: user.id,
                    })
                  : {},
            },
          },
        ],
        customAccessTokenClaims: async ({ user }) => {
          if (user) await requireActiveHuman(db, user.id);
          return {};
        },
        customIdTokenClaims: async ({ scopes, user }) => {
          await requireActiveHuman(db, user.id);
          if (!scopes.includes("email")) return {};
          return {
            email: user.email,
            email_verified: user.emailVerified,
          };
        },
        customUserInfoClaims: async ({ user }) => {
          await requireActiveHuman(db, user.id);
          return {};
        },
      }),
      createOAuthConsentAccessPlugin(environment),
    ],
    secret: environment.BETTER_AUTH_SECRET,
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
    rateLimit: {
      customRules: {
        "/request-password-reset": { max: 5, window: 60 },
        "/sign-in/email": { max: 5, window: 60 },
        "/sign-up/email": { max: 5, window: 60 },
      },
      customStorage: {
        consume: async (key, rule) => consumeRateLimit(environment.DB, key, rule),
      },
      enabled: true,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            try {
              const activePrincipal = await db
                .select({ ok: sql<number>`1` })
                .from(humanPrincipals)
                .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
                .where(
                  and(
                    eq(humanPrincipals.userId, session.userId),
                    eq(humanPrincipals.status, "active"),
                    eq(humanPrincipals.disabled, false),
                    eq(principals.type, "human"),
                    eq(principals.status, "active"),
                  ),
                )
                .get();

              return activePrincipal?.ok === 1;
            } catch {
              return false;
            }
          },
          after: async (session) => {
            await recordAuthAudit(db, "auth.session_created", session.userId, {
              sessionId: session.id,
            });
          },
        },
        delete: {
          after: async (session) => {
            await recordAuthAudit(db, "auth.session_revoked", session.userId, {
              sessionId: session.id,
            });
          },
        },
      },
    },
    telemetry: {
      enabled: false,
    },
    trustedOrigins: [environment.BETTER_AUTH_URL],
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
let authInsntance: AuthInstance | null = null;
export const getAuth = (): AuthInstance => (authInsntance ??= createAuth(env));

async function consumeRateLimit(
  database: D1Database,
  key: string,
  rule: { max: number; window: number },
) {
  const now = Date.now();
  const windowMilliseconds = rule.window * 1000;
  const bucket = await consumeRateLimitBucket(database, key, rule.window);

  if (!bucket) return { allowed: false, retryAfter: rule.window };

  const retryAfter = Math.max(
    0,
    Math.ceil((bucket.windowStartedAt + windowMilliseconds - now) / 1000),
  );

  return {
    allowed: bucket.count <= rule.max,
    retryAfter,
  };
}

async function recordAuthAudit(
  database: ReturnType<typeof createDb>,
  eventType: string,
  userId: string,
  metadata: Record<string, unknown>,
) {
  const principal = await database
    .select({ principalId: humanPrincipals.principalId })
    .from(humanPrincipals)
    .where(eq(humanPrincipals.userId, userId))
    .get();

  const now = Date.now();
  await database
    .insert(auditEvents)
    .values({
      id: `${eventType}:${userId}:${now}:${crypto.randomUUID()}`,
      eventType,
      actorPrincipalId: principal?.principalId ?? null,
      subjectPrincipalId: principal?.principalId ?? null,
      subjectUserId: userId,
      metadata: JSON.stringify(metadata),
      createdAt: now,
    })
    .onConflictDoNothing()
    .run();
}

async function requireActiveHuman(database: ReturnType<typeof createDb>, userId: string) {
  const activePrincipal = await database
    .select({ ok: sql<number>`1` })
    .from(humanPrincipals)
    .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .where(
      and(
        eq(humanPrincipals.userId, userId),
        eq(humanPrincipals.status, "active"),
        eq(humanPrincipals.disabled, false),
        eq(principals.type, "human"),
        eq(principals.status, "active"),
      ),
    )
    .get();

  if (activePrincipal?.ok !== 1) throw new Error("Active human principal required.");
}
