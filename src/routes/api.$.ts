import { env } from "cloudflare:workers";
import { edenFetch } from "@elysiajs/eden";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core/request-response";

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
        createApiApp(env).fetch(
          new Request(input, withIncomingAuthHeaders(stripBodyForSafeMethods(init))),
        ),
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

function withIncomingAuthHeaders(init: RequestInit) {
  const headers = new Headers(init.headers);
  const incomingHeaders = readIncomingRequestHeaders();
  if (!incomingHeaders) return { ...init, headers };

  for (const name of ["authorization", "cookie"]) {
    const value = incomingHeaders.get(name);
    if (value && !headers.has(name)) headers.set(name, value);
  }
  return { ...init, headers };
}

function readIncomingRequestHeaders() {
  try {
    return getRequestHeaders();
  } catch (error) {
    if (error instanceof Error && error.message.includes("No StartEvent found")) return;
    throw error;
  }
}
