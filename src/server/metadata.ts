import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { type AuthEnvironment, createAuth } from "./auth";

const rootMetadataPath = "/.well-known/oauth-authorization-server/api/auth";

export async function handleRootOAuthAuthorizationServerMetadata(
  request: Request,
  environment: AuthEnvironment,
): Promise<Response | undefined> {
  const pathname = new URL(request.url).pathname.replace(/\/$/, "");
  if (pathname !== rootMetadataPath || request.method !== "GET") return undefined;

  return oauthProviderAuthServerMetadata(createAuth(environment))(request);
}
