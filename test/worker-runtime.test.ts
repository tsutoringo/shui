import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { createLocalJWKSet, jwtVerify } from "jose";
import { describe, expect, it } from "vite-plus/test";

const origin = "http://localhost:8787";
const issuer = `${origin}/api/auth`;
const resourceIdentifier = `${origin}/api`;
const resourceScopes = ["openid", "profile", "email", "api:read"];
const bootstrapToken = "test-bootstrap-token-for-shui-m1";

let rootFixturePromise: Promise<{ cookie: string; userId: string }> | undefined;
let testClientIp = 1;

type TokenResponse = {
  access_token: string;
  expires_at: number;
  expires_in: number;
  id_token?: string;
  scope: string;
  token_type: string;
};

type JwtKeySet = { keys: JsonWebKey[] };

async function prepareOAuthResource(customClaims: Record<string, unknown> = {}) {
  const discoveryResponse = await SELF.fetch(`${origin}/api/auth/.well-known/openid-configuration`);
  expect(discoveryResponse.status).toBe(200);

  await env.DB.prepare(
    `INSERT INTO oauth_resource
      (id, identifier, name, access_token_ttl, allowed_scopes, custom_claims, disabled, policy_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(identifier) DO UPDATE SET
       allowed_scopes = excluded.allowed_scopes,
       custom_claims = excluded.custom_claims,
       disabled = excluded.disabled`,
  )
    .bind(
      crypto.randomUUID(),
      resourceIdentifier,
      "Shui API",
      3600,
      JSON.stringify(resourceScopes),
      JSON.stringify(customClaims),
      0,
      1,
    )
    .run();
}

async function sha256Base64Url(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function createOAuthClient(options: {
  authMethod: "none" | "client_secret_basic";
  clientCredentialsScopes?: string[];
  clientId: string;
  clientSecret?: string;
  grantTypes: string[];
  redirectUris: string[];
  requirePKCE: boolean;
  responseTypes: string[];
  scopes: string[];
}) {
  const now = Date.now();
  const storedSecret = options.clientSecret ? await sha256Base64Url(options.clientSecret) : null;

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO oauth_client
        (id, client_id, client_secret, disabled, skip_consent, subject_type,
         scopes, client_credentials_scopes, redirect_uris, token_endpoint_auth_method,
         grant_types, response_types, require_pkce, application_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      options.clientId,
      storedSecret,
      0,
      1,
      "public",
      JSON.stringify(options.scopes),
      JSON.stringify(options.clientCredentialsScopes ?? []),
      JSON.stringify(options.redirectUris),
      options.authMethod,
      JSON.stringify(options.grantTypes),
      JSON.stringify(options.responseTypes),
      options.requirePKCE ? 1 : 0,
      "web",
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO oauth_client_resource (id, client_id, resource_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), options.clientId, resourceIdentifier, now),
  ]);
}

async function ensureRoot() {
  if (rootFixturePromise) return rootFixturePromise;

  rootFixturePromise = (async () => {
    const email = "m1-root@example.com";
    const password = "correct-horse-battery-staple";
    const reserveResponse = await SELF.fetch(`${origin}/api/setup/reserve`, {
      body: JSON.stringify({ bootstrapToken }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(reserveResponse.status).toBe(200);
    const reservation = (await reserveResponse.json()) as { reservationId: string };

    const completeResponse = await SELF.fetch(`${origin}/api/setup/complete`, {
      body: JSON.stringify({
        bootstrapToken,
        email,
        name: "M1 Root",
        password,
        reservationId: reservation.reservationId,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(completeResponse.status).toBe(200);

    const rootUser = await env.DB.prepare("SELECT email_verified FROM user WHERE email = ?")
      .bind(email)
      .first<{ email_verified: number }>();
    expect(rootUser?.email_verified).toBe(0);

    const signInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({ email, password }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.0.0.${testClientIp++}`,
      },
      method: "POST",
    });
    expect(signInResponse.status).toBe(200);

    return {
      cookie: signInResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "",
      userId: ((await completeResponse.json()) as { userId: string }).userId,
    };
  })();

  return rootFixturePromise;
}

async function signUpUser(name = "OAuth Test") {
  const email = `oauth-${crypto.randomUUID()}@example.com`;
  const password = "correct-horse-battery-staple";
  const root = await ensureRoot();
  const invitationResponse = await SELF.fetch(`${origin}/api/invitations`, {
    body: JSON.stringify({ email }),
    headers: {
      "content-type": "application/json",
      cookie: root.cookie,
    },
    method: "POST",
  });
  expect(invitationResponse.status).toBe(200);
  const invitation = (await invitationResponse.json()) as { token: string };

  const response = await SELF.fetch(`${origin}/api/invitations/${invitation.token}/accept`, {
    body: JSON.stringify({ email, name, password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  expect(response.status).toBe(200);
  const user = await env.DB.prepare("SELECT id, email_verified FROM user WHERE email = ?")
    .bind(email)
    .first<{ email_verified: number; id: string }>();
  expect(user?.id).toBeTruthy();
  expect(user?.email_verified).toBe(0);

  const signInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
    body: JSON.stringify({ email, password }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${testClientIp++}`,
    },
    method: "POST",
  });
  const setCookie = signInResponse.headers.get("set-cookie");

  expect(signInResponse.status).toBe(200);
  expect(setCookie).toContain("better-auth.session_token=");

  return {
    cookie: setCookie?.split(";", 1)[0] ?? "",
    email,
    password,
    userId: user?.id ?? "",
  };
}

async function createPendingInvitation(
  options: { email?: string; expiresInSeconds?: number } = {},
) {
  const root = await ensureRoot();
  const email = options.email ?? `pending-${crypto.randomUUID()}@example.com`;
  const response = await SELF.fetch(`${origin}/api/invitations`, {
    body: JSON.stringify({ email, expiresInSeconds: options.expiresInSeconds }),
    headers: {
      "content-type": "application/json",
      cookie: root.cookie,
    },
    method: "POST",
  });
  const invitation = (await response.json()) as { id: string; token: string };
  expect(response.status).toBe(200);
  return { ...invitation, email };
}

async function authorizeWithPkce(clientId: string, cookie: string) {
  const verifier = `verifier-${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const challenge = await sha256Base64Url(verifier);
  const state = crypto.randomUUID();
  const redirectUri = `${origin}/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    response_type: "code",
    resource: resourceIdentifier,
    scope: "openid profile email",
    state,
  });
  const response = await SELF.fetch(`${origin}/api/auth/oauth2/authorize?${params}`, {
    headers: { cookie },
    redirect: "manual",
  });
  const location = response.headers.get("location");

  expect(response.status).toBe(302);
  expect(location).toBeTruthy();

  const callback = new URL(location ?? redirectUri);
  expect(callback.origin).toBe(origin);
  expect(callback.searchParams.get("state")).toBe(state);
  expect(callback.searchParams.get("code")).toBeTruthy();

  return {
    code: callback.searchParams.get("code") ?? "",
    redirectUri,
    verifier,
  };
}

async function exchangeAuthorizationCode(
  clientId: string,
  authorization: { code: string; redirectUri: string; verifier: string },
) {
  return SELF.fetch(`${origin}/api/auth/oauth2/token`, {
    body: new URLSearchParams({
      client_id: clientId,
      code: authorization.code,
      code_verifier: authorization.verifier,
      grant_type: "authorization_code",
      redirect_uri: authorization.redirectUri,
      resource: resourceIdentifier,
    }).toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
}

async function getJwkSet() {
  const response = await SELF.fetch(`${origin}/api/auth/jwks`);
  expect(response.status).toBe(200);
  return createLocalJWKSet((await response.json()) as JwtKeySet);
}

describe("Shui worker runtime", () => {
  it("serves the Elysia health endpoint", async () => {
    const response = await SELF.fetch(`${origin}/api/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ service: "shui-api", status: "ok" });
  });

  it("applies the D1 migration and exposes Better Auth health", async () => {
    const table = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
      .bind("user")
      .first<{ name: string }>();
    const response = await SELF.fetch(`${origin}/api/auth/ok`);

    expect(table?.name).toBe("user");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("signs in with email/password and preserves the session cookie", async () => {
    const user = await signUpUser("Sign-in Test");

    const signInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({ email: user.email, password: user.password }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const setCookie = signInResponse.headers.get("set-cookie");

    expect(signInResponse.status).toBe(200);
    expect(setCookie).toContain("better-auth.session_token=");

    const sessionResponse = await SELF.fetch(`${origin}/api/auth/get-session`, {
      headers: { cookie: setCookie?.split(";", 1)[0] ?? "" },
    });

    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      user: { email: user.email },
    });

    const invalidSignInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({ email: user.email, password: "wrong-password" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(invalidSignInResponse.status).toBe(401);
  });

  it("rejects unrestricted public sign-up", async () => {
    const response = await SELF.fetch(`${origin}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email: `public-${crypto.randomUUID()}@example.com`,
        name: "Public Sign-up",
        password: "correct-horse-battery-staple",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    });
  });

  it("binds invitations to one email and consumes them once", async () => {
    const invitation = await createPendingInvitation();
    const wrongEmailResponse = await SELF.fetch(
      `${origin}/api/invitations/${invitation.token}/accept`,
      {
        body: JSON.stringify({
          email: `wrong-${crypto.randomUUID()}@example.com`,
          name: "Wrong User",
          password: "correct-horse-battery-staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    expect(wrongEmailResponse.status).toBe(400);

    const acceptResponse = await SELF.fetch(
      `${origin}/api/invitations/${invitation.token}/accept`,
      {
        body: JSON.stringify({
          email: invitation.email,
          name: "Invited User",
          password: "correct-horse-battery-staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    expect(acceptResponse.status).toBe(200);

    const replayResponse = await SELF.fetch(
      `${origin}/api/invitations/${invitation.token}/accept`,
      {
        body: JSON.stringify({
          email: invitation.email,
          name: "Invited User",
          password: "correct-horse-battery-staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    expect(replayResponse.status).toBe(409);
  });

  it("revokes and expires invitations", async () => {
    const revoked = await createPendingInvitation();
    const root = await ensureRoot();
    const revokeResponse = await SELF.fetch(`${origin}/api/invitations/${revoked.id}/revoke`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(revokeResponse.status).toBe(200);

    const expired = await createPendingInvitation({ expiresInSeconds: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const expiredResponse = await SELF.fetch(`${origin}/api/invitations/${expired.token}`);
    expect(expiredResponse.status).toBe(404);
  });

  it("disables a claimed invitation that expires before completion", async () => {
    const invitation = await createPendingInvitation();
    const acceptResponse = await SELF.fetch(
      `${origin}/api/invitations/${invitation.token}/accept`,
      {
        body: JSON.stringify({
          email: invitation.email,
          name: "Expiring User",
          password: "correct-horse-battery-staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    expect(acceptResponse.status).toBe(200);

    const invitedUser = await env.DB.prepare("SELECT id FROM user WHERE email = ?")
      .bind(invitation.email)
      .first<{ id: string }>();
    expect(invitedUser?.id).toBeTruthy();
    await env.DB.prepare(
      `UPDATE invitations
          SET status = 'claimed', expires_at = ?, claimed_principal_id = NULL
        WHERE id = ?`,
    )
      .bind(Date.now() - 1, invitation.id)
      .run();

    const expiredResponse = await SELF.fetch(`${origin}/api/invitations/${invitation.token}`);
    expect(expiredResponse.status).toBe(404);

    const principal = await env.DB.prepare(
      `SELECT p.status, hp.status AS human_status, hp.disabled
         FROM principals p
         JOIN human_principals hp ON hp.principal_id = p.id
        WHERE hp.user_id = ?`,
    )
      .bind(invitedUser?.id)
      .first<{ status: string; human_status: string; disabled: number }>();
    expect(principal).toEqual({ disabled: 1, human_status: "disabled", status: "disabled" });

    const signInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({
        email: invitation.email,
        password: "correct-horse-battery-staple",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(signInResponse.status).not.toBe(200);

    const root = await ensureRoot();
    const reinviteResponse = await SELF.fetch(`${origin}/api/invitations`, {
      body: JSON.stringify({ email: invitation.email }),
      headers: {
        "content-type": "application/json",
        cookie: root.cookie,
      },
      method: "POST",
    });
    expect(reinviteResponse.status).toBe(200);
    const reinvitation = (await reinviteResponse.json()) as { token: string };
    const newPassword = "another-correct-horse-battery";
    const reacceptResponse = await SELF.fetch(
      `${origin}/api/invitations/${reinvitation.token}/accept`,
      {
        body: JSON.stringify({
          email: invitation.email,
          name: "Reinvited User",
          password: newPassword,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    expect(reacceptResponse.status).toBe(200);
    const reSignInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({ email: invitation.email, password: newPassword }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(reSignInResponse.status).toBe(200);
  });

  it("revokes claimed invitations and disables their principal", async () => {
    const invitation = await createPendingInvitation();
    const acceptResponse = await SELF.fetch(
      `${origin}/api/invitations/${invitation.token}/accept`,
      {
        body: JSON.stringify({
          email: invitation.email,
          name: "Revoked User",
          password: "correct-horse-battery-staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    expect(acceptResponse.status).toBe(200);
    const invitedUser = await env.DB.prepare("SELECT id FROM user WHERE email = ?")
      .bind(invitation.email)
      .first<{ id: string }>();
    await env.DB.prepare(
      "UPDATE invitations SET status = 'claimed', claimed_principal_id = NULL WHERE id = ?",
    )
      .bind(invitation.id)
      .run();

    const root = await ensureRoot();
    const revokeResponse = await SELF.fetch(`${origin}/api/invitations/${invitation.id}/revoke`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(revokeResponse.status).toBe(200);

    const principal = await env.DB.prepare(
      `SELECT p.status, hp.status AS human_status, hp.disabled
         FROM principals p
         JOIN human_principals hp ON hp.principal_id = p.id
        WHERE hp.user_id = ?`,
    )
      .bind(invitedUser?.id)
      .first<{ status: string; human_status: string; disabled: number }>();
    expect(principal).toEqual({ disabled: 1, human_status: "disabled", status: "disabled" });

    const replayResponse = await SELF.fetch(
      `${origin}/api/invitations/${invitation.token}/accept`,
      {
        body: JSON.stringify({
          email: invitation.email,
          name: "Revoked User",
          password: "correct-horse-battery-staple",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    expect(replayResponse.status).toBe(409);
  });

  it("revokes disabled-user sessions and protects the last root", async () => {
    const root = await ensureRoot();
    const user = await signUpUser("Disable Test");
    const disableResponse = await SELF.fetch(`${origin}/api/users/${user.userId}/disable`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(disableResponse.status).toBe(200);

    const sessionResponse = await SELF.fetch(`${origin}/api/auth/get-session`, {
      headers: { cookie: user.cookie },
    });
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toBeNull();

    const rootDisableResponse = await SELF.fetch(`${origin}/api/users/${root.userId}/disable`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(rootDisableResponse.status).toBe(409);

    const enableResponse = await SELF.fetch(`${origin}/api/users/${user.userId}/enable`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(enableResponse.status).toBe(200);
  });

  it("completes Authorization Code + PKCE and validates the JWT and ID Token", async () => {
    await prepareOAuthResource({ "https://shui.example/m0": "from-d1" });
    const clientId = `m0-pkce-${crypto.randomUUID()}`;
    const user = await signUpUser();

    await createOAuthClient({
      authMethod: "none",
      clientId,
      grantTypes: ["authorization_code"],
      redirectUris: [`${origin}/oauth/callback`],
      requirePKCE: true,
      responseTypes: ["code"],
      scopes: ["openid", "profile", "email"],
    });

    const authorization = await authorizeWithPkce(clientId, user.cookie);
    const response = await exchangeAuthorizationCode(clientId, authorization);
    const body = (await response.json()) as TokenResponse;

    expect(response.status).toBe(200);
    expect(body.token_type).toBe("Bearer");
    expect(body.scope).toBe("openid profile email");
    expect(body.id_token).toBeTruthy();

    const jwks = await getJwkSet();
    const accessToken = await jwtVerify(body.access_token, jwks, {
      audience: resourceIdentifier,
      issuer,
    });
    expect(accessToken.payload.sub).toBe(user.userId);
    expect(accessToken.payload.client_id).toBe(clientId);
    expect(accessToken.payload.azp).toBe(clientId);
    expect(accessToken.payload["https://shui.example/m0"]).toBe("from-d1");

    const idToken = await jwtVerify(body.id_token ?? "", jwks, {
      audience: clientId,
      issuer,
    });
    expect(idToken.payload.aud).toBe(clientId);
    expect(idToken.payload.sub).toBe(user.userId);
  });

  it("completes Client Credentials with a JWT access token", async () => {
    await prepareOAuthResource({ "https://shui.example/m0": "from-d1" });
    const clientId = `m0-m2m-${crypto.randomUUID()}`;
    const clientSecret = `secret-${crypto.randomUUID()}-${crypto.randomUUID()}`;

    await createOAuthClient({
      authMethod: "client_secret_basic",
      clientCredentialsScopes: ["api:read"],
      clientId,
      clientSecret,
      grantTypes: ["client_credentials"],
      redirectUris: [],
      requirePKCE: false,
      responseTypes: [],
      scopes: ["api:read"],
    });

    const response = await SELF.fetch(`${origin}/api/auth/oauth2/token`, {
      body: new URLSearchParams({
        grant_type: "client_credentials",
        resource: resourceIdentifier,
        scope: "api:read",
      }).toString(),
      headers: {
        authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
    const body = (await response.json()) as TokenResponse;

    expect(response.status).toBe(200);
    expect(body.scope).toBe("api:read");
    expect(body.id_token).toBeUndefined();

    const jwks = await getJwkSet();
    const accessToken = await jwtVerify(body.access_token, jwks, {
      audience: resourceIdentifier,
      issuer,
    });
    expect(accessToken.payload.sub).toBe(clientId);
    expect(accessToken.payload.client_id).toBe(clientId);
    expect(accessToken.payload.azp).toBe(clientId);
    expect(accessToken.payload["https://shui.example/m0"]).toBe("from-d1");
  });

  it("rejects resource-less API token requests", async () => {
    await prepareOAuthResource();
    const clientId = `m0-resource-required-${crypto.randomUUID()}`;
    const clientSecret = `secret-${crypto.randomUUID()}-${crypto.randomUUID()}`;
    await createOAuthClient({
      authMethod: "client_secret_basic",
      clientCredentialsScopes: ["api:read"],
      clientId,
      clientSecret,
      grantTypes: ["client_credentials"],
      redirectUris: [],
      requirePKCE: false,
      responseTypes: [],
      scopes: ["api:read"],
    });

    const response = await SELF.fetch(`${origin}/api/auth/oauth2/token`, {
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "api:read" }).toString(),
      headers: {
        authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_target" });

    const authorizeResponse = await SELF.fetch(`${origin}/api/auth/oauth2/authorize`, {
      body: new URLSearchParams({ scope: "api:read" }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    expect(authorizeResponse.status).toBe(400);
    await expect(authorizeResponse.json()).resolves.toMatchObject({ error: "invalid_target" });
  });

  it("allows only one concurrent authorization-code redemption", async () => {
    await prepareOAuthResource();
    const clientId = `m0-race-${crypto.randomUUID()}`;
    const user = await signUpUser();

    await createOAuthClient({
      authMethod: "none",
      clientId,
      grantTypes: ["authorization_code"],
      redirectUris: [`${origin}/oauth/callback`],
      requirePKCE: true,
      responseTypes: ["code"],
      scopes: ["openid", "profile", "email"],
    });

    const authorization = await authorizeWithPkce(clientId, user.cookie);
    const responses = await Promise.all([
      exchangeAuthorizationCode(clientId, authorization),
      exchangeAuthorizationCode(clientId, authorization),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    const successful = responses.filter((response) => response.status === 200);
    const rejected = bodies.filter(
      (body) => typeof body === "object" && body !== null && "error" in body,
    );

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ error: "invalid_grant" });
  });

  it("serves JWKS and issuer-path discovery metadata", async () => {
    const jwksResponse = await SELF.fetch(`${origin}/api/auth/jwks`);
    const openIdResponse = await SELF.fetch(`${origin}/api/auth/.well-known/openid-configuration`);
    const authorizationServerResponse = await SELF.fetch(
      `${origin}/api/auth/.well-known/oauth-authorization-server`,
    );
    const rootAliasResponse = await SELF.fetch(
      `${origin}/.well-known/oauth-authorization-server/api/auth`,
    );

    expect(jwksResponse.status).toBe(200);
    await expect(jwksResponse.json()).resolves.toMatchObject({ keys: expect.any(Array) });
    expect(openIdResponse.status).toBe(200);
    await expect(openIdResponse.json()).resolves.toMatchObject({
      issuer: `${origin}/api/auth`,
    });
    expect(authorizationServerResponse.status).toBe(200);
    expect(rootAliasResponse.status).toBe(200);
    await expect(rootAliasResponse.json()).resolves.toMatchObject({
      issuer: `${origin}/api/auth`,
    });
  });

  it("manages human principals, flat teams, and team membership", async () => {
    const root = await ensureRoot();
    const member = await signUpUser("M2 Team Member");

    const usersResponse = await SELF.fetch(`${origin}/api/users`, {
      headers: { cookie: root.cookie },
    });
    expect(usersResponse.status).toBe(200);
    const usersBody = (await usersResponse.json()) as {
      users: Array<{ id: string; principalId: string | null; email: string }>;
    };
    const listedMember = usersBody.users.find((user) => user.id === member.userId);
    expect(listedMember?.principalId).toBe(`human_${member.userId}`);

    const createTeamResponse = await SELF.fetch(`${origin}/api/teams`, {
      body: JSON.stringify({ description: "Platform operators", name: "Platform" }),
      headers: { "content-type": "application/json", cookie: root.cookie },
      method: "POST",
    });
    expect(createTeamResponse.status).toBe(200);
    const team = (await createTeamResponse.json()) as { id: string };

    const addMemberResponse = await SELF.fetch(`${origin}/api/teams/${team.id}/members`, {
      body: JSON.stringify({ userId: member.userId }),
      headers: { "content-type": "application/json", cookie: root.cookie },
      method: "POST",
    });
    expect(addMemberResponse.status).toBe(200);

    const teamsResponse = await SELF.fetch(`${origin}/api/teams`, {
      headers: { cookie: root.cookie },
    });
    expect(teamsResponse.status).toBe(200);
    await expect(teamsResponse.json()).resolves.toMatchObject({
      teams: expect.arrayContaining([
        expect.objectContaining({
          id: team.id,
          memberCount: 1,
          members: expect.arrayContaining([expect.objectContaining({ id: member.userId })]),
        }),
      ]),
    });

    const removeMemberResponse = await SELF.fetch(
      `${origin}/api/teams/${team.id}/members/${member.userId}`,
      { headers: { cookie: root.cookie }, method: "DELETE" },
    );
    expect(removeMemberResponse.status).toBe(200);
  });

  it("requires ownership transfer before disabling a user or team owner", async () => {
    const root = await ensureRoot();
    const owner = await signUpUser("M2 Owner");

    const teamResponse = await SELF.fetch(`${origin}/api/teams`, {
      body: JSON.stringify({ name: "M2 Ownership Team" }),
      headers: { "content-type": "application/json", cookie: root.cookie },
      method: "POST",
    });
    expect(teamResponse.status).toBe(200);
    const team = (await teamResponse.json()) as { id: string };

    const accountResponse = await SELF.fetch(`${origin}/api/service-accounts`, {
      body: JSON.stringify({
        name: "M2 Provisioner",
        ownerId: `human_${owner.userId}`,
        ownerType: "user",
      }),
      headers: { "content-type": "application/json", cookie: root.cookie },
      method: "POST",
    });
    expect(accountResponse.status).toBe(200);
    const account = (await accountResponse.json()) as { id: string };

    const addServiceMemberResponse = await SELF.fetch(`${origin}/api/teams/${team.id}/members`, {
      body: JSON.stringify({ userId: account.id }),
      headers: { "content-type": "application/json", cookie: root.cookie },
      method: "POST",
    });
    expect(addServiceMemberResponse.status).toBe(409);

    const disableOwnerResponse = await SELF.fetch(`${origin}/api/users/${owner.userId}/disable`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(disableOwnerResponse.status).toBe(409);

    const transferResponse = await SELF.fetch(
      `${origin}/api/service-accounts/${account.id}/transfer-ownership`,
      {
        body: JSON.stringify({ ownerId: team.id, ownerType: "team" }),
        headers: { "content-type": "application/json", cookie: root.cookie },
        method: "POST",
      },
    );
    expect(transferResponse.status).toBe(200);

    const disableOwnerAfterTransferResponse = await SELF.fetch(
      `${origin}/api/users/${owner.userId}/disable`,
      { headers: { cookie: root.cookie }, method: "POST" },
    );
    expect(disableOwnerAfterTransferResponse.status).toBe(200);

    const disableTeamResponse = await SELF.fetch(`${origin}/api/teams/${team.id}/disable`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(disableTeamResponse.status).toBe(409);
  });

  it("enforces system-role grants and protects the last active root", async () => {
    const root = await ensureRoot();
    const user = await signUpUser("M2 Role Subject");

    const grantResponse = await SELF.fetch(`${origin}/api/users/${user.userId}/system-roles`, {
      body: JSON.stringify({ roleKey: "user-admin" }),
      headers: { "content-type": "application/json", cookie: root.cookie },
      method: "POST",
    });
    expect(grantResponse.status).toBe(200);
    await expect(grantResponse.json()).resolves.toMatchObject({
      roleKey: "user-admin",
      status: "granted",
    });

    const delegatedUsersResponse = await SELF.fetch(`${origin}/api/users`, {
      headers: { cookie: user.cookie },
    });
    expect(delegatedUsersResponse.status).toBe(200);
    const delegatedServiceAccountsResponse = await SELF.fetch(`${origin}/api/service-accounts`, {
      headers: { cookie: user.cookie },
    });
    expect(delegatedServiceAccountsResponse.status).toBe(403);

    const usersResponse = await SELF.fetch(`${origin}/api/users`, {
      headers: { cookie: root.cookie },
    });
    const usersBody = (await usersResponse.json()) as {
      users: Array<{ id: string; roles: string[] }>;
    };
    expect(usersBody.users.find((candidate) => candidate.id === user.userId)?.roles).toContain(
      "user-admin",
    );

    const revokeResponse = await SELF.fetch(
      `${origin}/api/users/${user.userId}/system-roles/user-admin`,
      { headers: { cookie: root.cookie }, method: "DELETE" },
    );
    expect(revokeResponse.status).toBe(200);

    const lastRootResponse = await SELF.fetch(
      `${origin}/api/users/${root.userId}/system-roles/root`,
      { headers: { cookie: root.cookie }, method: "DELETE" },
    );
    expect(lastRootResponse.status).toBe(409);
  });

  it("repairs a Better Auth user that has no human principal mapping", async () => {
    const root = await ensureRoot();
    const userId = `legacy-${crypto.randomUUID()}`;
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(userId, "Legacy User", `${userId}@example.com`, 0, now, now)
      .run();

    const beforeResponse = await SELF.fetch(`${origin}/api/users`, {
      headers: { cookie: root.cookie },
    });
    const before = (await beforeResponse.json()) as {
      users: Array<{ id: string; status: string; principalId: string | null }>;
    };
    expect(before.users.find((user) => user.id === userId)).toMatchObject({
      principalId: null,
      status: "unmanaged",
    });

    const repairResponse = await SELF.fetch(`${origin}/api/users/${userId}/repair`, {
      headers: { cookie: root.cookie },
      method: "POST",
    });
    expect(repairResponse.status).toBe(200);
    await expect(repairResponse.json()).resolves.toMatchObject({
      principalId: `human_${userId}`,
      status: "repaired",
      userId,
    });
  });
});
