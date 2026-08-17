export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export async function authFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(`/api${path}`, { ...init, headers });
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    throw new AuthApiError(readErrorMessage(body), response.status);
  }

  return body as T;
}

export function safeRedirect(value: string | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function formatAuthError(error: unknown) {
  if (error instanceof AuthApiError && error.status === 429) {
    return "Too many attempts. Wait a moment and try again.";
  }

  if (error instanceof Error && error.message) return error.message;
  return "The request could not be completed.";
}

function readErrorMessage(value: unknown) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }

  return "The request could not be completed.";
}
