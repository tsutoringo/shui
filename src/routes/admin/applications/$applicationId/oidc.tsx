import { createFileRoute } from "@tanstack/react-router";

import { ApplicationClientsTab } from "../../../../components/admin/applications-admin-page";

export const Route = createFileRoute("/admin/applications/$applicationId/oidc")({
  component: ApplicationClientsTab,
});
