import { createFileRoute } from "@tanstack/react-router";

import { ApplicationOverviewTab } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId/")({
  component: ApplicationOverviewTab,
});
