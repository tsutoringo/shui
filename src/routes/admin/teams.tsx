import { createFileRoute } from "@tanstack/react-router";

import { TeamsAdminPage } from "~/features/teams";
import { adminRoutePermissions, requireAdminPermission } from "~/features/admin";

export const Route = createFileRoute("/admin/teams")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(context.adminAccess, adminRoutePermissions.teams, location.href),
  component: TeamsAdminPage,
});
