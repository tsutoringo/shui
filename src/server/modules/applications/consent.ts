import { getOAuthProviderState } from "@better-auth/oauth-provider";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { and, eq } from "drizzle-orm";

import { oauthClient } from "../../../db/auth-schema";
import { createDb } from "../../../db";
import {
  applicationOauthClients,
  applicationResources,
  applications,
  humanPrincipals,
  principals,
  teamApplicationAssignments,
  teamMemberships,
  teams,
  userApplicationAssignments,
} from "../../../db/domain-schema";
import type { AuthEnvironment } from "../../auth";

export type ConsentAccessReason =
  | "assigned"
  | "client_disabled"
  | "application_disabled"
  | "principal_disabled"
  | "not_assigned"
  | "resource_mismatch";

export type ConsentAccessDecision = {
  application?: {
    id: string;
    name: string;
    resourceIdentifier: string;
  };
  assignmentSource?: "direct" | "team";
  authorized: boolean;
  clientId: string;
  managed: boolean;
  reason?: ConsentAccessReason;
};

type ConsentRequest = {
  clientId: string;
  resources: string[];
};

export function createOAuthConsentAccessPlugin(environment: AuthEnvironment): BetterAuthPlugin {
  const database = createDb(environment.DB);

  const recheckConsentAccess = createAuthMiddleware(async (ctx) => {
    const request = await readConsentRequest();
    if (!request) return;

    const session = await getSessionFromCtx(ctx);
    if (!session?.user) return;

    const decision = await evaluateConsentAccess(database, {
      clientId: request.clientId,
      resources: request.resources,
      userId: session.user.id,
    });

    if (decision.managed && !decision.authorized) {
      const body = ctx.body as { accept?: unknown } | undefined;
      if (body) body.accept = false;
    }
  });

  const oauthConsentPreflight = createAuthEndpoint(
    "/oauth2/consent/preflight",
    {
      method: "POST",
      requireHeaders: true,
      use: [sessionMiddleware],
      metadata: {
        noStore: true,
        openapi: {
          description: "Check effective Application Assignment before OAuth consent.",
          responses: {
            "200": {
              description: "OAuth consent access decision.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      authorized: { type: "boolean" },
                      clientId: { type: "string" },
                      managed: { type: "boolean" },
                    },
                    required: ["authorized", "clientId", "managed"],
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const request = await readConsentRequest();
      if (!request) {
        throw new APIError("BAD_REQUEST", {
          error: "invalid_request",
          error_description: "A signed OAuth query is required.",
        });
      }

      const session = await getSessionFromCtx(ctx);
      if (!session?.user) {
        throw new APIError("UNAUTHORIZED", {
          error: "login_required",
          error_description: "A signed-in user is required.",
        });
      }

      return evaluateConsentAccess(database, {
        clientId: request.clientId,
        resources: request.resources,
        userId: session.user.id,
      });
    },
  );

  return {
    id: "shui-oauth-consent-access",
    endpoints: { oauthConsentPreflight },
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/oauth2/consent" && ctx.body?.accept === true,
          handler: recheckConsentAccess,
        },
      ],
    },
  };
}

export async function evaluateConsentAccess(
  database: ReturnType<typeof createDb>,
  input: { clientId: string; resources: string[]; userId: string },
): Promise<ConsentAccessDecision> {
  const client = await database
    .select({
      applicationId: applicationOauthClients.applicationId,
      applicationName: applications.name,
      applicationStatus: applications.status,
      clientDisabled: oauthClient.disabled,
      resourceIdentifier: applicationResources.resourceIdentifier,
    })
    .from(applicationOauthClients)
    .innerJoin(oauthClient, eq(oauthClient.clientId, applicationOauthClients.clientId))
    .innerJoin(applications, eq(applications.id, applicationOauthClients.applicationId))
    .innerJoin(applicationResources, eq(applicationResources.applicationId, applications.id))
    .where(eq(applicationOauthClients.clientId, input.clientId))
    .get();

  if (!client) {
    return {
      authorized: true,
      clientId: input.clientId,
      managed: false,
    };
  }

  const application = {
    id: client.applicationId,
    name: client.applicationName,
    resourceIdentifier: client.resourceIdentifier,
  };
  const baseDecision = {
    application,
    clientId: input.clientId,
    managed: true as const,
  };

  if (
    input.resources.length > 0 &&
    (input.resources.length !== 1 || input.resources[0] !== client.resourceIdentifier)
  ) {
    return {
      ...baseDecision,
      authorized: false,
      reason: "resource_mismatch",
    };
  }

  if (client.clientDisabled === true) {
    return {
      ...baseDecision,
      authorized: false,
      reason: "client_disabled",
    };
  }

  if (client.applicationStatus !== "active") {
    return {
      ...baseDecision,
      authorized: false,
      reason: "application_disabled",
    };
  }

  const principal = await database
    .select({ principalId: humanPrincipals.principalId })
    .from(humanPrincipals)
    .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .where(
      and(
        eq(humanPrincipals.userId, input.userId),
        eq(humanPrincipals.status, "active"),
        eq(humanPrincipals.disabled, false),
        eq(principals.type, "human"),
        eq(principals.status, "active"),
      ),
    )
    .get();

  if (!principal) {
    return {
      ...baseDecision,
      authorized: false,
      reason: "principal_disabled",
    };
  }

  const [directAssignment, teamAssignment] = await Promise.all([
    database
      .select({ id: userApplicationAssignments.id })
      .from(userApplicationAssignments)
      .where(
        and(
          eq(userApplicationAssignments.applicationId, client.applicationId),
          eq(userApplicationAssignments.userPrincipalId, principal.principalId),
          eq(userApplicationAssignments.status, "active"),
        ),
      )
      .get(),
    database
      .select({ teamId: teamApplicationAssignments.teamId })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .innerJoin(
        teamApplicationAssignments,
        and(
          eq(teamApplicationAssignments.teamId, teamMemberships.teamId),
          eq(teamApplicationAssignments.applicationId, client.applicationId),
          eq(teamApplicationAssignments.status, "active"),
        ),
      )
      .where(
        and(eq(teamMemberships.userPrincipalId, principal.principalId), eq(teams.status, "active")),
      )
      .get(),
  ]);

  if (directAssignment) {
    return {
      ...baseDecision,
      assignmentSource: "direct",
      authorized: true,
      reason: "assigned",
    };
  }

  if (teamAssignment) {
    return {
      ...baseDecision,
      assignmentSource: "team",
      authorized: true,
      reason: "assigned",
    };
  }

  return {
    ...baseDecision,
    authorized: false,
    reason: "not_assigned",
  };
}

async function readConsentRequest(): Promise<ConsentRequest | null> {
  const state = await getOAuthProviderState();
  if (!state?.query) return null;

  const query = new URLSearchParams(state.query);
  const clientId = query.get("client_id");
  if (!clientId) return null;

  return {
    clientId,
    resources: query.getAll("resource"),
  };
}
