import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";

const origin = "http://localhost:8787";

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
