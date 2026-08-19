import { createAuth } from "../../auth";
import { Elysia } from "elysia";

import { ApiError } from "../errors";
import { CommonModels } from "../models/common";
import { shuiPlugin } from "../plugin";
import {
  claimInvitationWithAuth,
  createInvitation,
  getPublicInvitation,
  revokeInvitation,
} from "./service";
import { InvitationModels } from "./models";

export const invitationsRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...InvitationModels })
  .post(
    "/invitations",
    async ({ actor, body, request, environment }) => {
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
    ({ params, request, environment }) => getPublicInvitation(environment, params.token, request),
    { params: "TokenParams", response: "InvitationPublic" },
  )
  .post(
    "/invitations/:token/accept",
    ({ body, params, request, environment }) =>
      claimInvitationWithAuth(environment, createAuth(environment), params.token, body, request),
    {
      body: "InvitationAcceptBody",
      params: "TokenParams",
      response: "InvitationAccepted",
    },
  )
  .post(
    "/invitations/:token/claim",
    ({ body, params, request, environment }) =>
      claimInvitationWithAuth(environment, createAuth(environment), params.token, body, request),
    {
      body: "InvitationAcceptBody",
      params: "TokenParams",
      response: "InvitationAccepted",
    },
  )
  .post(
    "/invitations/:token/complete",
    ({ body, params, request, environment }) =>
      claimInvitationWithAuth(environment, createAuth(environment), params.token, body, request),
    {
      body: "InvitationAcceptBody",
      params: "TokenParams",
      response: "InvitationAccepted",
    },
  )
  .post(
    "/invitations/:token/revoke",
    async ({ actor, params, request, environment }) =>
      revokeInvitation(environment, actor, params.token, request),
    {
      params: "TokenParams",
      requirePermission: "users:write",
      response: "InvitationRevoked",
    },
  );
