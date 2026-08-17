import { createFileRoute } from "@tanstack/react-router";

import { ApplicationAccessTab } from "~/features/applications";

export const Route = createFileRoute("/admin/applications/$applicationId/access")({
  component: ApplicationAccessTab,
});
