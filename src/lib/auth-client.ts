import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: "/api/auth",
  plugins: [oauthProviderClient()],
});
