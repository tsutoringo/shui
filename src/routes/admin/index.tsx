import { createFileRoute, redirect } from "@tanstack/react-router";

import { firstAdminPath } from "~/features/admin";

export const Route = createFileRoute("/admin/")({
  beforeLoad: ({ context }) => {
    throw redirect({ to: firstAdminPath(context.adminAccess) });
  },
});
