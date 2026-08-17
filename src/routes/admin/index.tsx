import { createFileRoute, redirect } from "@tanstack/react-router";

import { firstAdminPath } from "../../lib/admin-routing";

export const Route = createFileRoute("/admin/")({
  beforeLoad: ({ context }) => {
    throw redirect({ to: firstAdminPath(context.adminAccess) });
  },
});
