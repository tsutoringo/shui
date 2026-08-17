import { createFileRoute } from "@tanstack/react-router";

import { ApplicationsAdminPage } from "../../../components/admin/applications-admin-page";

export const Route = createFileRoute("/admin/applications/")({
  component: ApplicationsAdminPage,
});
