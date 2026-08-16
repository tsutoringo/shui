import { getTreaty } from "../routes/api.$";
import type {
  BootstrapCompleteBody,
  BootstrapTokenBody,
  InvitationAcceptBody,
  InvitationCreateBody,
} from "../server/modules/models";

export type {
  BootstrapComplete,
  BootstrapReservation,
  InvitationAccepted,
  InvitationCreated,
  InvitationPublic,
} from "../server/modules/models";

export class M1ClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "M1ClientError";
  }
}

export async function m1Fetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (!response.ok) {
    throw new M1ClientError(readErrorMessage(body), response.status);
  }

  return body as T;
}

export async function reserveBootstrap(body: BootstrapTokenBody) {
  return unwrapTreatyResponse(await getTreaty().setup.reserve.post(body));
}

export async function completeBootstrap(body: BootstrapCompleteBody) {
  return unwrapTreatyResponse(await getTreaty().setup.complete.post(body));
}

export async function createInvitation(body: InvitationCreateBody) {
  return unwrapTreatyResponse(await getTreaty().invitations.post(body));
}

export async function getInvitation(token: string) {
  return unwrapTreatyResponse(await getTreaty().invitations({ token }).get());
}

export async function acceptInvitation(token: string, body: InvitationAcceptBody) {
  return unwrapTreatyResponse(await getTreaty().invitations({ token }).accept.post(body));
}

function unwrapTreatyResponse<T>(result: { data: T | null; error: unknown; status: number }) {
  if (result.error) {
    const value =
      result.error && typeof result.error === "object" && "value" in result.error
        ? result.error.value
        : result.error;
    throw new M1ClientError(readErrorMessage(value), result.status);
  }

  if (result.data === null) {
    throw new M1ClientError("The request could not be completed.", result.status);
  }

  return result.data;
}

function readErrorMessage(value: unknown) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }

  return "The request could not be completed.";
}

export function safeRedirect(value: string | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function formatClientError(error: unknown) {
  if (error instanceof M1ClientError && error.status === 429) {
    return "Too many attempts. Wait a moment and try again.";
  }

  if (error instanceof Error && error.message) return error.message;
  return "The request could not be completed.";
}
