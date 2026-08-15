import { Elysia, t } from "elysia";

import { type AuthEnvironment, createAuth } from "./auth";

export function createApiApp(environment: AuthEnvironment) {
  const auth = createAuth(environment);

  return new Elysia({ aot: false, prefix: "/api" })
    .get("/health", () => ({ service: "shui-api", status: "ok" as const }), {
      response: t.Object({
        service: t.String(),
        status: t.Literal("ok"),
      }),
    })
    .head("/health", () => new Response(null, { status: 204 }))
    .mount(auth.handler);
}

export type ApiApp = ReturnType<typeof createApiApp>;
