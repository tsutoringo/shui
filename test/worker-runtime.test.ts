import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { createLocalJWKSet, jwtVerify } from "jose";
import { describe, expect, it } from "vite-plus/test";

const origin = "http://localhost:8787";
const issuer = `${origin}/api/auth`;
const resourceIdentifier = `${origin}/api`;
const resourceScopes = ["openid", "profile", "email", "api:read"];

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

async function signUpUser() {
  const email = `oauth-${crypto.randomUUID()}@example.com`;
  const password = "correct-horse-battery-staple";
  const response = await SELF.fetch(`${origin}/api/auth/sign-up/email`, {
    body: JSON.stringify({ email, name: "OAuth Test", password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body = (await response.json()) as { user: { id: string } };
  const setCookie = response.headers.get("set-cookie");

  expect(response.status).toBe(200);
  expect(setCookie).toContain("better-auth.session_token=");

  return {
    cookie: setCookie?.split(";", 1)[0] ?? "",
    userId: body.user.id,
  };
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
    const email = `sign-in-${crypto.randomUUID()}@example.com`;
    const password = "correct-horse-battery-staple";
    const signUpResponse = await SELF.fetch(`${origin}/api/auth/sign-up/email`, {
      body: JSON.stringify({ email, name: "Sign-in Test", password }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(signUpResponse.status).toBe(200);

    const signInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({ email, password }),
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
      user: { email },
    });

    const invalidSignInResponse = await SELF.fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({ email, password: "wrong-password" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(invalidSignInResponse.status).toBe(401);
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
});
