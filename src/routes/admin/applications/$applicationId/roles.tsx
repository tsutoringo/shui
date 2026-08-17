import { createFileRoute } from "@tanstack/react-router";

import { ApplicationRolesTab } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId/roles")({
  component: ApplicationRolesTab,
});
