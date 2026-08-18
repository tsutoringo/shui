import { createFileRoute } from "@tanstack/react-router";

import { ApplicationClientDetailPage } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId/oidc/$clientId")({
  component: ApplicationClientDetailRoute,
});

function ApplicationClientDetailRoute() {
  const { applicationId, clientId } = Route.useParams();

  return <ApplicationClientDetailPage applicationId={applicationId} clientId={clientId} />;
}
