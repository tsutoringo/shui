import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth/minimal";
import { jwt } from "better-auth/plugins/jwt";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:8787";

// The CLI only needs the option and plugin schemas. Runtime requests add the D1 adapter.
const auth = betterAuth({
  appName: "Shui",
  basePath: "/api/auth",
  baseURL,
  database: drizzleAdapter(
    {},
    {
      provider: "sqlite",
      transaction: false,
    },
  ),
  emailAndPassword: { enabled: true },
  plugins: [
    jwt(),
    oauthProvider({
      allowDynamicClientRegistration: false,
      allowUnauthenticatedClientRegistration: false,
      consentPage: "/consent",
      grantTypes: ["authorization_code", "client_credentials"],
      loginPage: "/sign-in",
      scopes: ["openid", "profile", "email"],
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
});

export { auth };
export default auth;
