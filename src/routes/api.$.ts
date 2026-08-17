import { env } from "cloudflare:workers";
import { edenFetch } from "@elysiajs/eden";
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

export const getApiFetch = createIsomorphicFn()
  .server(() =>
    edenFetch<ApiApp>(env.BETTER_AUTH_URL, {
      fetcher: async (input, init) =>
        createApiApp(env).fetch(new Request(input, stripBodyForSafeMethods(init))),
    }),
  )
  .client(() =>
    edenFetch<ApiApp>(window.location.origin, {
      fetcher: async (input, init) => fetch(input, stripBodyForSafeMethods(init)),
    }),
  );

function stripBodyForSafeMethods(init: RequestInit = {}) {
  const method = init.method?.toUpperCase() ?? "GET";
  if (method !== "GET" && method !== "HEAD") return init;

  const headers = new Headers(init.headers);
  headers.delete("content-type");
  const { body: _body, ...safeInit } = init;
  return { ...safeInit, headers };
}
