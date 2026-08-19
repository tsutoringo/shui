import type {
  InvitationAcceptBody,
  InvitationAccepted,
  InvitationCreateBody,
  InvitationCreated,
  InvitationPublic,
} from "~/server/modules/invitations/models";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

const emptyRequest = { body: {}, headers: {} } as const;

export type { InvitationAccepted, InvitationCreated, InvitationPublic };

export async function createInvitation(body: InvitationCreateBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/invitations", { body, headers: {}, method: "POST" }),
  );
}

export async function getInvitation(token: string) {
  return unwrapApiResponse(
    await getApiFetch()("/api/invitations/:token", {
      ...emptyRequest,
      method: "GET",
      params: { token },
    }),
  );
}

export async function acceptInvitation(token: string, body: InvitationAcceptBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/invitations/:token/accept", {
      body,
      headers: {},
      method: "POST",
      params: { token },
    }),
  );
}
