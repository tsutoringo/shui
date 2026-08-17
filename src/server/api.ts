import { Elysia, t } from "elysia";

import { PASSWORD_RESET_TIMING_FLOOR_MS, type AuthEnvironment, createAuth } from "./auth";
import { createApiRoutes } from "./modules";

export function createApiApp(environment: AuthEnvironment) {
  const auth = createAuth(environment);

  return new Elysia({ aot: false, prefix: "/api" })
    .onRequest(async ({ request }) => requireApiResource(request))
    .use(createApiRoutes(environment, auth))
    .get("/health", () => ({ service: "shui-api", status: "ok" as const }), {
      response: t.Object({
        service: t.String(),
        status: t.Literal("ok"),
      }),
    })
    .head("/health", () => new Response(null, { status: 204 }))
    .mount(async (request) => {
      const isPasswordReset =
        request.method === "POST" &&
        new URL(request.url).pathname.endsWith("/auth/request-password-reset");
      const startedAt = Date.now();
      const response = await auth.handler(request);
      if (isPasswordReset) {
        const remaining = PASSWORD_RESET_TIMING_FLOOR_MS - (Date.now() - startedAt);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      return response;
    });
}

export type ApiApp = ReturnType<typeof createApiApp>;

async function requireApiResource(request: Request) {
  const url = new URL(request.url);
  const isAuthorize = url.pathname.endsWith("/oauth2/authorize");
  const isToken = url.pathname.endsWith("/oauth2/token");
  if (!isAuthorize && !isToken) return;

  if (isAuthorize) {
    const params = request.method === "GET" ? url.searchParams : await readOAuthBody(request);
    const scopes = params.get("scope")?.split(/\s+/) ?? [];
    if (scopes.includes("api:read") && !params.getAll("resource").some(Boolean)) {
      return invalidResourceResponse();
    }
    return;
  }

  const body = await readOAuthBody(request);
  if (body.get("grant_type") === "client_credentials" && !body.getAll("resource").some(Boolean)) {
    return invalidResourceResponse();
  }
}

async function readOAuthBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(await request.clone().text());
  }

  if (contentType.includes("application/json")) {
    const body = (await request
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null;
    const params = new URLSearchParams();
    if (typeof body?.grant_type === "string") params.set("grant_type", body.grant_type);
    if (typeof body?.scope === "string") params.set("scope", body.scope);
    if (typeof body?.resource === "string") params.append("resource", body.resource);
    if (Array.isArray(body?.resource)) {
      for (const resource of body.resource) {
        if (typeof resource === "string") params.append("resource", resource);
      }
    }
    return params;
  }

  return new URLSearchParams();
}

function invalidResourceResponse() {
  return new Response(
    JSON.stringify({
      error: "invalid_target",
      error_description: "The api:read scope requires a resource indicator.",
    }),
    { headers: { "content-type": "application/json" }, status: 400 },
  );
}
