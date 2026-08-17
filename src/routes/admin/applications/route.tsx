import { Outlet, createFileRoute } from "@tanstack/react-router";

import { adminRoutePermissions, requireAdminPermission } from "../../../lib/admin-routing";

export const Route = createFileRoute("/admin/applications")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(context.adminAccess, adminRoutePermissions.applications, location.href),
  component: () => <Outlet />,
});
