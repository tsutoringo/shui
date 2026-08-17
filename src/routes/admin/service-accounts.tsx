import { createFileRoute } from "@tanstack/react-router";

import { ServiceAccountsAdminPage } from "../../components/admin/service-accounts-admin-page";
import { adminRoutePermissions, requireAdminPermission } from "../../lib/admin-routing";

export const Route = createFileRoute("/admin/service-accounts")({
  beforeLoad: ({ context, location }) =>
    requireAdminPermission(
      context.adminAccess,
      adminRoutePermissions.serviceAccounts,
      location.href,
    ),
  component: ServiceAccountsAdminPage,
});
