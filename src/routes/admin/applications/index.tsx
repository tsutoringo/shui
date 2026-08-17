import { createFileRoute } from "@tanstack/react-router";

import { ApplicationsAdminPage } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/")({
  component: ApplicationsAdminPage,
});
