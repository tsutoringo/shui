import { createFileRoute } from "@tanstack/react-router";

import { TeamsAdminPage } from "../components/teams-admin-page";

export const Route = createFileRoute("/teams")({ component: TeamsAdminPage });
