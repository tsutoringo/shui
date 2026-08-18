import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";

import { ApplicationClientsTab } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId/oidc")({
  component: ApplicationOidcRoute,
});

function ApplicationOidcRoute() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return pathname.endsWith("/oidc") ? <ApplicationClientsTab /> : <Outlet />;
}
