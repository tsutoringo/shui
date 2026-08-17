import { createFileRoute } from "@tanstack/react-router";

import { ServiceAccountsAdminPage } from "~/features/service-accounts";
import { adminRoutePermissions, requireAdminPermission } from "~/features/admin";

export const Route = createFileRoute("/admin/service-accounts")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(
      context.adminAccess,
      adminRoutePermissions.serviceAccounts,
      location.href,
    ),
  component: ServiceAccountsAdminPage,
});
