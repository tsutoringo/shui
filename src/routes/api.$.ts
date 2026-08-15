import { env } from "cloudflare:workers";
import { treaty } from "@elysiajs/eden";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

import { type ApiApp, createApiApp } from "../server/api";

const handle = ({ request }: { request: Request }) => createApiApp(env).fetch(request);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      DELETE: handle,
      GET: handle,
      HEAD: handle,
      OPTIONS: handle,
      PATCH: handle,
      POST: handle,
      PUT: handle,
    },
  },
});

export const getTreaty = createIsomorphicFn()
  .server(() => treaty(createApiApp(env)).api)
  .client(() => treaty<ApiApp>(window.location.origin).api);
