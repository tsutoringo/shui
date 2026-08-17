import { createFileRoute } from "@tanstack/react-router";

import { InvitationPage } from "../components/auth/invitation-page";

export const Route = createFileRoute("/invite/$token")({
  component: InvitationRoute,
});

function InvitationRoute() {
  const { token } = Route.useParams();
  return <InvitationPage token={token} />;
}
