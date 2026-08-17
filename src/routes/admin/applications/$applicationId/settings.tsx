import { createFileRoute } from "@tanstack/react-router";

import { ApplicationSettingsTab } from "../../../../components/admin/applications-admin-page";

export const Route = createFileRoute("/admin/applications/$applicationId/settings")({
  component: ApplicationSettingsTab,
});
