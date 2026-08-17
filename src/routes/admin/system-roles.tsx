import { createFileRoute } from "@tanstack/react-router";

import { SystemRolesAdminPage } from "~/features/system-roles";
import { adminRoutePermissions, requireAdminPermission } from "~/features/admin";

export const Route = createFileRoute("/admin/system-roles")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(context.adminAccess, adminRoutePermissions.systemRoles, location.href),
  component: SystemRolesAdminPage,
});
