import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordPage } from "../components/auth/password-recovery-page";

export const Route = createFileRoute("/reset-password/$token")({
  component: ResetPasswordTokenRoute,
});

function ResetPasswordTokenRoute() {
  const { token } = Route.useParams();
  return <ResetPasswordPage token={token} />;
}
