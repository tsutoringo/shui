import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireAdminAccess } from "../../lib/admin-routing";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context, location }) => ({
    adminAccess: await requireAdminAccess(context.queryClient, location.href),
  }),
  component: () => <Outlet />,
});
