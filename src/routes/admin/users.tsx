import { createFileRoute } from "@tanstack/react-router";

import { UsersAdminPage } from "../../components/users-admin-page";
import { adminRoutePermissions, requireAdminPermission } from "../../lib/admin-routing";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(context.adminAccess, adminRoutePermissions.users, location.href),
  component: UsersAdminPage,
});
