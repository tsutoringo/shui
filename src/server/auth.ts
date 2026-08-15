import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth/minimal";
import { jwt } from "better-auth/plugins/jwt";
import { createDb } from "../db";
import * as authSchema from "../db/auth-schema";

export interface AuthEnvironment {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

export function createAuth(environment: AuthEnvironment) {
  const resourceIdentifier = `${environment.BETTER_AUTH_URL}/api`;

  return betterAuth({
    appName: "Shui",
    basePath: "/api/auth",
    baseURL: environment.BETTER_AUTH_URL,
    database: drizzleAdapter(createDb(environment.DB), {
      provider: "sqlite",
      schema: authSchema,
      transaction: false,
    }),
    disabledPaths: ["/token"],
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      jwt(),
      oauthProvider({
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
        clientRegistrationAllowedResources: [resourceIdentifier],
        clientRegistrationDefaultResources: [resourceIdentifier],
        consentPage: "/consent",
        enforcePerClientResources: true,
        grantTypes: ["authorization_code", "client_credentials"],
        loginPage: "/sign-in",
        resources: [
          {
            accessTokenTtl: 3600,
            allowedScopes: ["openid", "profile", "email"],
            identifier: resourceIdentifier,
            name: "Shui API",
          },
        ],
        scopes: ["openid", "profile", "email"],
      }),
    ],
    secret: environment.BETTER_AUTH_SECRET,
    telemetry: {
      enabled: false,
    },
    trustedOrigins: [environment.BETTER_AUTH_URL],
  });
}
