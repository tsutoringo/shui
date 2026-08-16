import { Elysia } from "elysia";

import {
  type AuthEnvironment,
  type AuthInstance,
  isLocalEnvironment,
  readDevelopmentEmailSink,
} from "../auth";
import { createAuthorizationPlugin } from "./authorization/plugin";
import { M1Error } from "./errors";
import { M1Models } from "./models";
import {
  completeBootstrap,
  completeSetup,
  getBootstrapStatus,
  reserveBootstrap,
} from "./bootstrap/service";
import {
  claimInvitationWithAuth,
  createInvitation,
  getPublicInvitation,
  revokeInvitation,
} from "./invitations/service";
import { setUserDisabled } from "./users/service";

export function createM1Routes(environment: AuthEnvironment, auth: AuthInstance) {
  return new Elysia({ name: "shui-m1-routes", normalize: false })
    .use(createAuthorizationPlugin(environment, auth))
    .model(M1Models)
    .prefix("model", "M1.")
    .error({ M1Error })
    .onBeforeHandle(({ request, set }) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        assertMutationOrigin(environment, request);
      }
      set.headers["cache-control"] = "no-store";
      set.headers.pragma = "no-cache";
    })
    .onError(({ code, error, set }) => {
      set.headers["cache-control"] = "no-store";
      set.headers.pragma = "no-cache";
      const statusCode =
        error instanceof M1Error ? error.statusCode : code === "VALIDATION" ? 400 : 500;
      set.status = statusCode;
      return {
        error: statusCode >= 500 ? "Request failed." : "The request could not be completed.",
      };
    })
    .get(
      "/dev/email-sink",
      () => {
        if (!isLocalEnvironment(environment)) throw new M1Error(404);
        return { messages: [...readDevelopmentEmailSink()] };
      },
      { response: "M1.EmailSink" },
    )
    .get("/bootstrap", () => getBootstrapStatus(environment), {
      response: "M1.BootstrapStatus",
    })
    .get("/bootstrap/status", () => getBootstrapStatus(environment), {
      response: "M1.BootstrapStatus",
    })
    .get("/setup", () => getBootstrapStatus(environment), {
      response: "M1.BootstrapStatus",
    })
    .get("/setup/status", () => getBootstrapStatus(environment), {
      response: "M1.BootstrapStatus",
    })
    .post("/bootstrap", ({ body, request }) => completeSetup(environment, auth, body, request), {
      body: "M1.BootstrapCompleteBody",
      response: "M1.BootstrapComplete",
    })
    .post("/setup", ({ body, request }) => completeSetup(environment, auth, body, request), {
      body: "M1.BootstrapCompleteBody",
      response: "M1.BootstrapComplete",
    })
    .post(
      "/bootstrap/reserve",
      ({ body, request }) => reserveBootstrap(environment, body, request),
      { body: "M1.BootstrapTokenBody", response: "M1.BootstrapReservation" },
    )
    .post("/setup/reserve", ({ body, request }) => reserveBootstrap(environment, body, request), {
      body: "M1.BootstrapTokenBody",
      response: "M1.BootstrapReservation",
    })
    .post(
      "/bootstrap/complete",
      ({ body, request }) => completeBootstrap(environment, auth, body, request),
      { body: "M1.BootstrapCompleteBody", response: "M1.BootstrapComplete" },
    )
    .post(
      "/setup/complete",
      ({ body, request }) => completeBootstrap(environment, auth, body, request),
      { body: "M1.BootstrapCompleteBody", response: "M1.BootstrapComplete" },
    )
    .post(
      "/invitations",
      async ({ actor, body, request }) => {
        if (body.systemRoleKeys?.length && !actor.roleKeys.has("root")) {
          throw new M1Error(403);
        }
        return createInvitation(environment, actor, body, request);
      },
      {
        body: "M1.InvitationCreateBody",
        requireRole: ["root", "user-admin"],
        response: "M1.InvitationCreated",
      },
    )
    .get(
      "/invitations/:token",
      ({ params, request }) => getPublicInvitation(environment, params.token, request),
      { params: "M1.TokenParams", response: "M1.InvitationPublic" },
    )
    .post(
      "/invitations/:token/accept",
      ({ body, params, request }) =>
        claimInvitationWithAuth(environment, auth, params.token, body, request),
      {
        body: "M1.InvitationAcceptBody",
        params: "M1.TokenParams",
        response: "M1.InvitationAccepted",
      },
    )
    .post(
      "/invitations/:token/claim",
      ({ body, params, request }) =>
        claimInvitationWithAuth(environment, auth, params.token, body, request),
      {
        body: "M1.InvitationAcceptBody",
        params: "M1.TokenParams",
        response: "M1.InvitationAccepted",
      },
    )
    .post(
      "/invitations/:token/complete",
      ({ body, params, request }) =>
        claimInvitationWithAuth(environment, auth, params.token, body, request),
      {
        body: "M1.InvitationAcceptBody",
        params: "M1.TokenParams",
        response: "M1.InvitationAccepted",
      },
    )
    .post(
      "/invitations/:token/revoke",
      async ({ actor, params, request }) => {
        return revokeInvitation(environment, actor, params.token, request);
      },
      {
        params: "M1.TokenParams",
        requireRole: ["root", "user-admin"],
        response: "M1.InvitationRevoked",
      },
    )
    .post(
      "/users/:id/disable",
      async ({ actor, params, request }) => {
        return setUserDisabled(environment, actor, params.id, true, request);
      },
      {
        params: "M1.UserParams",
        requireRole: ["root", "user-admin"],
        response: "M1.UserStatus",
      },
    )
    .post(
      "/users/:id/enable",
      async ({ actor, params, request }) => {
        return setUserDisabled(environment, actor, params.id, false, request);
      },
      {
        params: "M1.UserParams",
        requireRole: ["root", "user-admin"],
        response: "M1.UserStatus",
      },
    );
}

function assertMutationOrigin(environment: AuthEnvironment, request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new M1Error(403);

  const expectedOrigin = new URL(environment.BETTER_AUTH_URL).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin) throw new M1Error(403);

  const referer = request.headers.get("referer");
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) throw new M1Error(403);
    } catch (error) {
      if (error instanceof M1Error) throw error;
      throw new M1Error(403);
    }
  }
}
