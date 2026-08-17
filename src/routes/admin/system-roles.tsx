import { createFileRoute } from "@tanstack/react-router";

import { SystemRolesAdminPage } from "../../components/system-roles-admin-page";
import { adminRoutePermissions, requireAdminPermission } from "../../lib/admin-routing";

export const Route = createFileRoute("/admin/system-roles")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(context.adminAccess, adminRoutePermissions.systemRoles, location.href),
  component: SystemRolesAdminPage,
});
