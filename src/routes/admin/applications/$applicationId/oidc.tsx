import { createFileRoute } from "@tanstack/react-router";

import { ApplicationClientsTab } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId/oidc")({
  component: ApplicationClientsTab,
});
