import { createFileRoute } from "@tanstack/react-router";

import { UsersAdminPage } from "~/features/users";
import { adminRoutePermissions, requireAdminPermission } from "~/features/admin";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(context.adminAccess, adminRoutePermissions.users, location.href),
  component: UsersAdminPage,
});
