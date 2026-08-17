import { createFileRoute } from "@tanstack/react-router";

import { InvitationPage } from "~/features/invitations";

export const Route = createFileRoute("/invite/$token")({
  component: InvitationRoute,
});

function InvitationRoute() {
  const { token } = Route.useParams();
  return <InvitationPage token={token} />;
}
