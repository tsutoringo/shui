import { createFileRoute } from "@tanstack/react-router";

import { ApplicationAccessTab } from "../../../../components/admin/applications-admin-page";

export const Route = createFileRoute("/admin/applications/$applicationId/access")({
  component: ApplicationAccessTab,
});
