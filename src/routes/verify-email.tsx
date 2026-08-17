import { createFileRoute } from "@tanstack/react-router";

import { VerifyEmailPage } from "../components/auth/verify-email-page";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: VerifyEmailRoute,
});

function VerifyEmailRoute() {
  const { token } = Route.useSearch();
  return <VerifyEmailPage token={token} />;
}
