import { type AuthEnvironment, type AuthInstance } from "../../auth";
import { createDomainApiRoutes } from "../api-plugin";
import { ApiError } from "../errors";
import {
  claimInvitationWithAuth,
  createInvitation,
  getPublicInvitation,
  revokeInvitation,
} from "./service";

export function createInvitationRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return createDomainApiRoutes(environment, auth, "invitations")
    .post(
      "/invitations",
      async ({ actor, body, request }) => {
        if (body.systemRoleKeys?.length && !actor.roleKeys.has("root")) {
          throw new ApiError(403);
        }
        return createInvitation(environment, actor, body, request);
      },
      {
        body: "InvitationCreateBody",
        requirePermission: "users:write",
        response: "InvitationCreated",
      },
    )
    .get(
      "/invitations/:token",
      ({ params, request }) => getPublicInvitation(environment, params.token, request),
      { params: "TokenParams", response: "InvitationPublic" },
    )
    .post(
      "/invitations/:token/accept",
      ({ body, params, request }) =>
        claimInvitationWithAuth(environment, auth, params.token, body, request),
      {
        body: "InvitationAcceptBody",
        params: "TokenParams",
        response: "InvitationAccepted",
      },
    )
    .post(
      "/invitations/:token/claim",
      ({ body, params, request }) =>
        claimInvitationWithAuth(environment, auth, params.token, body, request),
      {
        body: "InvitationAcceptBody",
        params: "TokenParams",
        response: "InvitationAccepted",
      },
    )
    .post(
      "/invitations/:token/complete",
      ({ body, params, request }) =>
        claimInvitationWithAuth(environment, auth, params.token, body, request),
      {
        body: "InvitationAcceptBody",
        params: "TokenParams",
        response: "InvitationAccepted",
      },
    )
    .post(
      "/invitations/:token/revoke",
      async ({ actor, params, request }) =>
        revokeInvitation(environment, actor, params.token, request),
      {
        params: "TokenParams",
        requirePermission: "users:write",
        response: "InvitationRevoked",
      },
    );
}
