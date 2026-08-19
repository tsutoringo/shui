import { createFileRoute } from "@tanstack/react-router";

import { shuiApi } from "~/server/api";
export { getApiFetch } from "~/shared/api/eden-fetch";

const handle = ({ request }: { request: Request }) => shuiApi.fetch(request);

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
