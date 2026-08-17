import { createFileRoute } from "@tanstack/react-router";

import { ApplicationOverviewTab } from "../../../../components/applications-admin-page";

export const Route = createFileRoute("/admin/applications/$applicationId/")({
  component: ApplicationOverviewTab,
});
