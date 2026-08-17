import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

import { createApiApp } from "~/server/api";
export { getApiFetch } from "~/shared/api/eden-fetch";

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
