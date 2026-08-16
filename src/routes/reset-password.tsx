import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordPage } from "../components/password-recovery-page";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { token } = Route.useSearch();
  return <ResetPasswordPage token={token} />;
}
