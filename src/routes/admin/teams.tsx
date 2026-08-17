import { createFileRoute } from "@tanstack/react-router";

import { TeamsAdminPage } from "../../components/teams-admin-page";
import { adminRoutePermissions, requireAdminPermission } from "../../lib/admin-routing";

export const Route = createFileRoute("/admin/teams")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(context.adminAccess, adminRoutePermissions.teams, location.href),
  component: TeamsAdminPage,
});
