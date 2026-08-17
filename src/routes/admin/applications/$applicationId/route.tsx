import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ApplicationDetailPage } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId")({
  component: ApplicationDetailRoute,
});

function ApplicationDetailRoute() {
  const { applicationId } = Route.useParams();

  return (
    <ApplicationDetailPage applicationId={applicationId}>
      <Outlet />
    </ApplicationDetailPage>
  );
}
