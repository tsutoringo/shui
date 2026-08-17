import { createFileRoute } from "@tanstack/react-router";

import { AuthPage } from "../components/auth/auth-page";
import { safeRedirect } from "../lib/auth-api";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignInRoute,
});

function SignInRoute() {
  const { redirect: redirectTo } = Route.useSearch();
  return <AuthPage redirectTo={safeRedirect(redirectTo)} />;
}
