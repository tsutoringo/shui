import { createFileRoute } from "@tanstack/react-router";

import { ApplicationRolesTab } from "../../../../components/applications-admin-page";

export const Route = createFileRoute("/admin/applications/$applicationId/roles")({
  component: ApplicationRolesTab,
});
