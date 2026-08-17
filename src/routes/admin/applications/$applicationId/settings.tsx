import { createFileRoute } from "@tanstack/react-router";

import { ApplicationSettingsTab } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId/settings")({
  component: ApplicationSettingsTab,
});
